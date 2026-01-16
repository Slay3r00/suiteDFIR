import sqlite3
import json
import os
import logging
import re
from typing import List, Optional, Dict, Any, Tuple
from core.database import db_fetch_all, DB_PATH

logger = logging.getLogger(__name__)

def regex_extract_date(text: str) -> Optional[str]:
    """
    Regex-based timestamp extraction from raw text/JSON.
    Focuses on SQL Core formats: YYYY-MM-DD HH:MM:SS (with optional precision and timezone).
    """
    if not text:
        return None
    
    # SQL Core Pattern: YYYY-MM-DD [T/space] HH:MM:SS[.SSSSSS][Z/+HH:MM]
    match = re.search(r'(\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}:\d{2}(\.\d+)?([+-]\d{2}:?\d{2}|Z)?)', text)
    if match:
        return match.group(1)
    
    return None

MONTH_MAP = {
    'jan': '01', 'january': '01',
    'feb': '02', 'february': '02',
    'mar': '03', 'march': '03',
    'apr': '04', 'april': '04',
    'may': '05',
    'jun': '06', 'june': '06',
    'jul': '07', 'july': '07',
    'aug': '08', 'august': '08',
    'sep': '09', 'sept': '09', 'september': '09',
    'oct': '10', 'october': '10',
    'nov': '11', 'november': '11',
    'dec': '12', 'december': '12',
}

class TimelineManager:
    """Manages timeline event generation from multiple report databases."""

    async def get_timeline_events(
        self,
        case_id: int,
        page: int = 0,
        limit: int = 10,
        sort_by: str = "date",
        sort_order: str = "desc",
        search: Optional[str] = None,
        filters: Optional[str] = None,
        report_id: Optional[int] = None
    ) -> Dict[str, Any]:
        """
        Fetch timeline events from tl.db files for a specific case.
        """
        try:
            # 1. Get reports and locate tl.db files
            timeline_dbs = await self._get_timeline_dbs(case_id, report_id)
            
            if not timeline_dbs:
                return {"data": [], "total_count": 0}

            # 2. Execute Query across databases
            return await self._execute_multi_db_query(
                timeline_dbs, page, limit, sort_by, sort_order, search, filters
            )

        except Exception as e:
            logger.error(f"Error fetching timeline: {e}")
            raise e

    async def _get_timeline_dbs(self, case_id: int, report_id: Optional[int] = None) -> List[Dict[str, str]]:
        """Fetch reports from DB and check for existence of tl.db files."""
        if report_id:
            reports = await db_fetch_all(
                'SELECT path, name FROM reports WHERE case_id = ? AND id = ?', 
                (case_id, report_id)
            )
        else:
            reports = await db_fetch_all(
                'SELECT path, name FROM reports WHERE case_id = ? ORDER BY created_at DESC', 
                (case_id,)
            )

        timeline_dbs = []
        for report in reports:
            report_path = report['path']
            report_name = report['name']
            
            tl_db_path = os.path.join(report_path, '_Timeline', 'tl.db')
            if os.path.exists(tl_db_path):
                timeline_dbs.append({
                    'path': tl_db_path,
                    'name': report_name
                })
        
        # Limit to 10 DBs for "All" view to avoid SQLite limits
        if not report_id and len(timeline_dbs) > 10:
            timeline_dbs = timeline_dbs[:10]
            
        return timeline_dbs

    async def _execute_multi_db_query(
        self,
        timeline_dbs: List[Dict[str, str]],
        page: int,
        limit: int,
        sort_by: str,
        sort_order: str,
        search: Optional[str],
        filters: Optional[str]
    ) -> Dict[str, Any]:
        """Construct and execute the complex UNION query using an in-memory database."""
        # Note: We use synchronous sqlite3 here because we are operating on an in-memory DB 
        # that attaches other DBs. This logic is complex to fully async-ify without 
        # a dedicated thread helper, but since it's read-only and local files, it's acceptable for now.
        # Ideally, we would run this entire method in a thread pool executor.
        import asyncio
        loop = asyncio.get_running_loop()
        
        def _run_query():
            mem_conn = sqlite3.connect(':memory:')
            mem_cursor = mem_conn.cursor()
            
            try:
                mem_conn.create_function("regex_extract_date", 1, regex_extract_date)
                
                select_parts = self._build_query_parts(mem_cursor, timeline_dbs, search, filters)
                
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
                
                formatted_data = self._format_results(rows, page, limit, total_count)
                
                return {
                    "data": formatted_data,
                    "total_count": total_count
                }
            finally:
                mem_conn.close()

        return await loop.run_in_executor(None, _run_query)

    def _build_query_parts(
        self, 
        mem_cursor: sqlite3.Cursor, 
        timeline_dbs: List[Dict[str, str]], 
        search: Optional[str], 
        filters: Optional[str]
    ) -> List[str]:
        """Attach databases and build the SELECT parts for each."""
        select_parts = []
        
        # Parse column filters
        column_filters = []
        if filters:
            try:
                column_filters = json.loads(filters)
            except:
                pass

        for i, db in enumerate(timeline_dbs):
            alias = f"db{i}"
            try:
                mem_cursor.execute(f"ATTACH DATABASE ? AS {alias}", (db['path'],))
                
                # Inspect schema
                db_conn = sqlite3.connect(db['path'])
                db_cursor = db_conn.cursor()
                db_cursor.execute("PRAGMA table_info(data)")
                columns = [row[1].lower() for row in db_cursor.fetchall()]
                db_conn.close()

                # Determine date column
                existing_date_col = next((c for c in columns if c in ('date', 'timestamp', 'time', 'event_date')), None)
                
                if existing_date_col:
                    timestamp_extract = f"COALESCE(NULLIF(NULLIF({existing_date_col}, 'None'), ''), regex_extract_date(datalist))"
                else:
                    timestamp_extract = "regex_extract_date(datalist)"
                
                escaped_name = db['name'].replace("'", "''")

                # Build WHERE clause
                where_clauses = self._build_where_clauses(
                    search, column_filters, escaped_name, timestamp_extract
                )

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
                
        return select_parts

    def _normalize_search_term(self, val: str) -> List[str]:
        """
        Produce a list of possible search variations to match raw data.
        Handles variations like "Dec 19", "Dec 19,", "Dec 19, 2017"
        """
        variations = {val} # Use set for uniqueness
        
        # 1. Clean up the value (strip trailing commas/dots and excess whitespace)
        clean_val = val.strip().rstrip(',.')
        if clean_val:
            variations.add(clean_val)
        
        # 2. Match "Month Day, Year" or "Month Day Year"
        # e.g. "Dec 19, 2017"
        match_full = re.match(r'^([a-zA-Z]+)\s+(\d{1,2})[,\s]+(\d{4})$', clean_val)
        if match_full:
            m_name = match_full.group(1).lower()
            day = match_full.group(2).zfill(2)
            year = match_full.group(3)
            if m_name in MONTH_MAP:
                variations.add(f"{year}-{MONTH_MAP[m_name]}-{day}")
        
        # 3. Match "Month Day"
        # e.g. "Dec 19"
        else:
            match_md = re.match(r'^([a-zA-Z]+)\s+(\d{1,2})$', clean_val)
            if match_md:
                m_name = match_md.group(1).lower()
                day = match_md.group(2).zfill(2)
                if m_name in MONTH_MAP:
                    variations.add(f"{MONTH_MAP[m_name]}-{day}")
                    variations.add(f"{MONTH_MAP[m_name]}/{day}")
            
            # 4. Match just "Month"
            elif clean_val.lower() in MONTH_MAP:
                variations.add(MONTH_MAP[clean_val.lower()])
            
        return list(variations)

    def _build_where_clauses(
        self, 
        search: Optional[str], 
        column_filters: List[Dict[str, Any]], 
        escaped_name: str, 
        timestamp_extract: str
    ) -> List[str]:
        """Build the list of SQL WHERE clauses."""
        where_clauses = []
        
        # Global Search
        if search:
            search_variations = self._normalize_search_term(search)
            search_parts = []
            for var in search_variations:
                term = f"%{var}%"
                search_parts.append(f"""
                    (
                        activity LIKE '{term}' OR 
                        datalist LIKE '{term}' OR 
                        '{escaped_name}' LIKE '{term}' OR
                        {timestamp_extract} LIKE '{term}'
                    )
                """)
            where_clauses.append("(" + " OR ".join(search_parts) + ")")

        # Column Filters
        for filter_item in column_filters:
            col_id = filter_item.get('id')
            val = filter_item.get('value')
            if not val:
                continue
            
            val_variations = self._normalize_search_term(val)
            filter_parts = []
            
            for var in val_variations:
                term = f"%{var}%"
                if col_id == 'artifact':
                    filter_parts.append(f"activity LIKE '{term}'")
                elif col_id == 'description':
                    filter_parts.append(f"datalist LIKE '{term}'")
                elif col_id == 'source':
                    filter_parts.append(f"'{escaped_name}' LIKE '{term}'")
                elif col_id == 'date':
                    filter_parts.append(f"{timestamp_extract} LIKE '{term}'")
            
            if filter_parts:
                where_clauses.append("(" + " OR ".join(filter_parts) + ")")
                
        return where_clauses

    def _format_results(
        self, 
        rows: List[Tuple], 
        page: int, 
        limit: int, 
        total_count: int
    ) -> List[Dict[str, Any]]:
        """Format the raw SQL rows into the API response format."""
        formatted_data = []
        for i, row in enumerate(rows):
            # row: source_report, artifact, description_json, event_date, original_key
            source = row[0]
            artifact = row[1]
            desc_json = row[2]
            date = row[3]
            
            # Format ID sequentially
            current_page = page if limit != -1 else 0
            page_size = limit if limit != -1 else total_count
            virtual_id = (current_page * page_size) + i + 1

            formatted_data.append({
                "id": virtual_id,
                "date": date,
                "artifact": artifact,
                "description": desc_json,
                "source": source
            })
        return formatted_data

# Global instance
timeline_manager = TimelineManager()
