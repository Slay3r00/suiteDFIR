from fastapi import APIRouter, HTTPException, Query
from typing import List, Optional, Dict, Any
import sqlite3
import json
import os
import logging
from database import get_db_connection, DB_PATH

logger = logging.getLogger(__name__)
router = APIRouter(
    prefix="/api/cases/{case_id}/timeline",
    tags=["timeline"]
)

@router.get("")
async def get_timeline(
    case_id: int,
    page: int = Query(0, ge=0),
    limit: int = Query(10, ge=-1),
    sort_by: str = Query("date", regex="^(date|artifact|description|source|id)$"),
    sort_order: str = Query("desc", regex="^(asc|desc)$"),
    search: Optional[str] = None,
    filters: Optional[str] = None,
    report_id: Optional[str] = None
):
    """
    Fetch timeline events from tl.db files for a specific case.
    Supports pagination, sorting, filtering by report, global search, and column filters.
    """
    try:
        # Parse column filters
        column_filters = []
        if filters:
            try:
                column_filters = json.loads(filters)
            except:
                pass

        # 1. Get reports for the case
        conn = sqlite3.connect(DB_PATH)
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()
        
        if report_id:
            cursor.execute('SELECT path, name FROM reports WHERE case_id = ? AND path = ?', (case_id, report_id))
        else:
            cursor.execute('SELECT path, name FROM reports WHERE case_id = ? ORDER BY created_at DESC', (case_id,))
            
        reports = cursor.fetchall()
        conn.close()
        
        if not reports:
            return {"data": [], "total_count": 0}

        # 2. Locate tl.db files
        timeline_dbs = []
        for report in reports:
            report_path = report['path']
            report_name = report['name']
            
            # Check for _Timeline/tl.db
            tl_db_path = os.path.join(report_path, '_Timeline', 'tl.db')
            if os.path.exists(tl_db_path):
                timeline_dbs.append({
                    'path': tl_db_path,
                    'name': report_name
                })

        if not timeline_dbs:
            return {"data": [], "total_count": 0}

        # Limit to 10 DBs for "All" view to avoid SQLite limits
        if not report_id and len(timeline_dbs) > 10:
            timeline_dbs = timeline_dbs[:10]

        # 3. Construct Query
        mem_conn = sqlite3.connect(':memory:')
        mem_cursor = mem_conn.cursor()
        
        select_parts = []
        for i, db in enumerate(timeline_dbs):
            alias = f"db{i}"
            try:
                mem_cursor.execute(f"ATTACH DATABASE ? AS {alias}", (db['path'],))
                
                # Extract timestamp
                # Handle 'None' string explicitly by treating it as empty
                # Comprehensive list of potential date/time keys found in forensic artifacts
                date_keys = [
                    'Timestamp', 'Sent', 'Date', 'Created', '"Received Time"', 
                    '"Last Modified Timestamp"', '"Starting Timestamp"', '"Call Date/Time"', 
                    '"Message Timestamp"', '"Read Timestamp"', '"Attachment Timestamp"', 
                    '"Last update time"', '"Last Joined"', '"Added At"', 'Modified', '"Last opened"',
                    '"Start Time"', '"End Time"', '"Added Date"', '"Creation Date"', 
                    '"Modification Date"', '"Modified Time"', '"Visit Time"', '"Last Seen Time"',
                    '"Date Created"', '"Date and Time"', '"Date and time"', 
                    '"Last Associated/Roamed At"', '"Last Connection Time"', '"Last Modification Time"',
                    '"Start Date"', '"End Date"', 'TimestampUTC', '"Update Time"', '"Visit Timestamp"',
                    '"Creation Time"', '"Date Joined"', '"Date added to Health"', '"Fire Date"',
                    '"First Usage Timestamp"', '"Last Connect Timestamp"', '"Last Update Date"',
                    '"Last Usage Timestamp"', '"Last Used Date"', '"Timestamp Modified"',
                    '"Created Time"', '"Date of Birth"', '"Last Modified"',
                    '"Start Timestamp"', '"End Timestamp"', '"Timestamp added to Health"'
                ]
                
                # Build COALESCE(NULLIF(NULLIF(..., 'None'), ''), ...) arguments
                # This ensures we skip both 'None' strings and empty strings to find a real value
                coalesce_args = ", ".join([f"NULLIF(NULLIF(json_extract(datalist, '$.{key}'), 'None'), '')" for key in date_keys])

                timestamp_extract = f"COALESCE({coalesce_args}, '')"
                
                # Escape single quotes for SQL
                escaped_name = db['name'].replace("'", "''")

                # Build WHERE clause for this DB
                where_clauses = []
                params = []

                # Global Search
                if search:
                    search_term = f"%{search}%"
                    where_clauses.append(f"""
                        (
                            activity LIKE '{search_term}' OR 
                            datalist LIKE '{search_term}' OR 
                            '{escaped_name}' LIKE '{search_term}' OR
                            {timestamp_extract} LIKE '{search_term}'
                        )
                    """)

                # Column Filters
                for filter_item in column_filters:
                    col_id = filter_item.get('id')
                    val = filter_item.get('value')
                    if not val:
                        continue
                    
                    val_term = f"%{val}%"
                    
                    if col_id == 'artifact':
                        where_clauses.append(f"activity LIKE '{val_term}'")
                    elif col_id == 'description':
                        where_clauses.append(f"datalist LIKE '{val_term}'")
                    elif col_id == 'source':
                        where_clauses.append(f"'{escaped_name}' LIKE '{val_term}'")
                    elif col_id == 'date':
                        where_clauses.append(f"{timestamp_extract} LIKE '{val_term}'")

                where_sql = ""
                if where_clauses:
                    where_sql = "WHERE " + " AND ".join(where_clauses)

                select_parts.append(f"""
                    SELECT 
                        '{escaped_name}' as source_report,
                        activity as artifact,
                        datalist as description_json,
                        {timestamp_extract} as event_date,
                        key as original_key
                    FROM {alias}.data
                    {where_sql}
                """)
            except sqlite3.OperationalError as e:
                logger.error(f"Error attaching {db['path']}: {e}")
                continue

        if not select_parts:
             return {"data": [], "total_count": 0}

        union_query = " UNION ALL ".join(select_parts)
        
        # Count total
        count_query = f"SELECT COUNT(*) FROM ({union_query})"
        mem_cursor.execute(count_query)
        total_count = mem_cursor.fetchone()[0]

        # Fetch page
        sort_map = {
            "date": "event_date",
            "artifact": "artifact",
            "source": "source_report",
            "description": "description_json",
            "id": "event_date"
        }
        sql_sort = sort_map.get(sort_by, "event_date")
        
        data_query = f"""
            SELECT * FROM ({union_query})
            ORDER BY {sql_sort} {sort_order.upper()}
        """
        
        if limit != -1:
            data_query += " LIMIT ? OFFSET ?"
            mem_cursor.execute(data_query, (limit, page * limit))
        else:
            mem_cursor.execute(data_query)
            
        rows = mem_cursor.fetchall()
        
        # 4. Format Data
        formatted_data = []
        for i, row in enumerate(rows):
            # row: source_report, artifact, description_json, event_date, original_key
            source = row[0]
            artifact = row[1]
            desc_json = row[2]
            date = row[3]
            
            # The frontend table now handles JSON parsing and date formatting
            # We just send the raw JSON string (desc_json)
            description = desc_json

            # Format ID sequentially
            current_page = page if limit != -1 else 0
            page_size = limit if limit != -1 else total_count
            virtual_id = (current_page * page_size) + i + 1

            formatted_data.append({
                "id": virtual_id,
                "date": date,
                "artifact": artifact,
                "description": description,
                "source": source
            })

        mem_conn.close()
        
        return {
            "data": formatted_data,
            "total_count": total_count
        }

    except Exception as e:
        logger.error(f"Error fetching timeline: {e}")
        raise HTTPException(status_code=500, detail=str(e))
