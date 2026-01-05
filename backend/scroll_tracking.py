# Enhanced scroll tracking script to inject into HTML reports
# Tracks: sidebar scroll, main content scroll, current page URL, and DataTables pagination

SCROLL_TRACKING_SCRIPT = """
<script>
(function() {
    // Throttle for performance
    let scrollTimeout;
    let sidebarTimeout;
    let dtTimeout;
    
    // Get sidebar element (LEAPP uses #sidebar_id)
    function getSidebar() {
        return document.getElementById('sidebar_id') || 
               document.querySelector('.sidebar-sticky') || 
               document.querySelector('.sidebar');
    }

    // Get DataTables page info if present
    function getDtPage() {
        if (typeof $ === 'undefined' || !$.fn.dataTable) return undefined;

        // Method 1: Global API
        const tables = $.fn.dataTable.tables({ visible: true, api: true });
        if (tables.any()) return tables.page();

        // Method 2: Fallback selector
        const fallbackTable = $('table.dataTable, table.display, table.table-striped').first();
        if (fallbackTable.length && fallbackTable.DataTable) {
             return fallbackTable.DataTable().page();
        }
        return undefined;
    }
    
    // Send combined state to parent
    function sendState() {
        const sidebar = getSidebar();
        let dtPageVal = undefined;

        try {
            dtPageVal = getDtPage();
        } catch (e) {
            // console.error(e);
        }

        const state = {
            type: 'reportState',
            mainScrollY: window.scrollY || document.documentElement.scrollTop,
            sidebarScrollY: sidebar ? sidebar.scrollTop : 0,
            currentPage: window.location.pathname + window.location.search,
            dtPage: dtPageVal
        };
        window.parent.postMessage(state, '*');
    }
    
    // Track main window scroll
    window.addEventListener('scroll', function() {
        clearTimeout(scrollTimeout);
        scrollTimeout = setTimeout(sendState, 100);
    }, { passive: true });
    
    // Track sidebar scroll if present
    function attachSidebarListener() {
        const sidebar = getSidebar();
        if (sidebar) {
            sidebar.addEventListener('scroll', function() {
                clearTimeout(sidebarTimeout);
                sidebarTimeout = setTimeout(sendState, 100);
            }, { passive: true });
        }
    }

    // Track DataTables pagination events
    function attachDtListener() {
        if (typeof $ !== 'undefined' && $.fn.dataTable) {
            $(document).on('page.dt length.dt', function() {
                clearTimeout(dtTimeout);
                dtTimeout = setTimeout(sendState, 100);
            });
        }
    }
    
    // Handle messages from parent
    window.addEventListener('message', function(event) {
        if (!event.data) return;
        
        // Restore full state
        if (event.data.type === 'restoreState') {
            const hasDt = typeof $ !== 'undefined' && $.fn.dataTable;
            console.log('[Injected] Restoring state:', event.data, 'HasDT:', hasDt);

            // 1. Restore DataTables Page (if applicable)
            if (event.data.dtPage !== undefined && hasDt) {
                // Method 1: Global API
                let tables = $.fn.dataTable.tables({ visible: true, api: true });
                let targetTableApi = null;

                if (tables.any()) {
                    targetTableApi = tables;
                } else {
                    // Method 2: Fallback selector
                    const fallbackTable = $('table.dataTable, table.display, table.table-striped').first();
                    if (fallbackTable.length && fallbackTable.DataTable) {
                         targetTableApi = fallbackTable.DataTable();
                    }
                }
                
                if (targetTableApi) {
                    const currentPage = targetTableApi.page();
                    const targetPage = event.data.dtPage;
                    
                    if (currentPage !== targetPage) {
                        targetTableApi.page(targetPage).draw('page');
                    }
                }
            }

            // 2. Restore Scroll Positions
            if (event.data.mainScrollY !== undefined) {
                window.scrollTo({ top: event.data.mainScrollY, behavior: 'instant' });
            }
            if (event.data.sidebarScrollY !== undefined) {
                const sidebar = getSidebar();
                if (sidebar) {
                    sidebar.scrollTop = event.data.sidebarScrollY;
                }
            }
        }
        
        // Legacy support for simple scroll
        if (event.data.type === 'scrollTo') {
            window.scrollTo({ top: event.data.scrollY, behavior: 'instant' });
        }
        
        // Request current state
        if (event.data.type === 'getState' || event.data.type === 'getScroll') {
            sendState();
        }
    });
    
    // Initialize on load
    window.addEventListener('load', function() {
        attachSidebarListener();
        attachDtListener();
        // Send initial state after a short delay
        setTimeout(sendState, 200);
    });
    
    // Also try to attach immediately in case DOM is already ready
    if (document.readyState === 'complete' || document.readyState === 'interactive') {
        attachSidebarListener();
        attachDtListener();
    }
})();
</script>
"""
