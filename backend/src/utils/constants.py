# Enhanced scroll tracking script to inject into HTML reports
# Tracks: sidebar scroll, main content scroll, current page URL, DataTables state (page length, page number) per artifact page, and active tabs

SCROLL_TRACKING_SCRIPT = """
<script>
(function() {
    let scrollTimeout, sidebarTimeout, dtTimeout;
    
    const getSidebar = () => document.getElementById('sidebar_id') ||
                            document.querySelector('.sidebar-sticky') ||
                            document.querySelector('.sidebar');

    const getActiveTab = () => {
        if (typeof $ === 'undefined') return undefined;
        const activeTab = $('.nav-tabs .nav-link.active').first();
        return activeTab.length ? activeTab.attr('id') : undefined;
    };

    const getDataTableState = () => {
        if (typeof $ === 'undefined' || !$.fn.dataTable) return null;
        const table = $('#dtBasicExample');
        if (!table.length || !table.DataTable()) return null;

        const api = table.DataTable();
        return {
            pageLength: api.page.len(),
            pageNum: api.page(),
            searchText: api.search()
        };
    };
    
    function sendState() {
        const sidebar = getSidebar();
        let dtStateVal, activeTabId;
        try {
            dtStateVal = getDataTableState();
            activeTabId = getActiveTab();
        } catch (e) {}

        const currentPageUrl = window.location.pathname + window.location.search;

        window.parent.postMessage({
            type: 'reportState',
            mainScrollY: window.scrollY || document.documentElement.scrollTop,
            sidebarScrollY: sidebar ? sidebar.scrollTop : 0,
            currentPage: currentPageUrl,
            dtStates: dtStateVal ? { [currentPageUrl]: dtStateVal } : undefined,
            activeTab: activeTabId
        }, '*');
    }
    
    window.addEventListener('scroll', () => {
        clearTimeout(scrollTimeout);
        scrollTimeout = setTimeout(sendState, 100);
    }, { passive: true });
    
    const attachListeners = () => {
        const sidebar = getSidebar();
        if (sidebar) {
            sidebar.addEventListener('scroll', () => {
                clearTimeout(sidebarTimeout);
                sidebarTimeout = setTimeout(sendState, 100);
            }, { passive: true });
        }
        if (typeof $ !== 'undefined') {
            if ($.fn.dataTable) {
                $(document).on('page.dt length.dt search.dt', () => {
                    clearTimeout(dtTimeout);
                    dtTimeout = setTimeout(sendState, 100);
                });
            }
            // Track Bootstrap tab changes
            $(document).on('shown.bs.tab', 'a[data-toggle="tab"]', () => {
                sendState();
            });
        }
    };

    window.addEventListener('message', (event) => {
        if (event.data?.type === 'restoreState') {
            const { dtStates, mainScrollY, sidebarScrollY, activeTab } = event.data;
            const hasJquery = typeof $ !== 'undefined';

            if (hasJquery && $.fn.dataTable) {
                const currentPageUrl = window.location.pathname + window.location.search;
                const table = $('#dtBasicExample');

                if (table.length && dtStates && dtStates[currentPageUrl]) {
                    const state = dtStates[currentPageUrl];
                    const api = table.DataTable();

                    // 1. Set page length first
                    if (state.pageLength !== undefined) {
                        api.page.len(state.pageLength).draw('page');
                    }

                    // 2. Set search text (before page number so it affects results)
                    if (state.searchText !== undefined && state.searchText !== '') {
                        api.search(state.searchText).draw();
                    }

                    // 3. Then set page number (after search so it shows correct page of filtered results)
                    if (state.pageNum !== undefined) {
                        setTimeout(() => {
                            api.page(state.pageNum).draw('page');
                        }, 50);
                    }
                }

                if (activeTab) {
                    $(`#${activeTab}`).tab('show');
                }
            }

            if (mainScrollY !== undefined) window.scrollTo({ top: mainScrollY, behavior: 'instant' });
            if (sidebarScrollY !== undefined) {
                const sidebar = getSidebar();
                if (sidebar) sidebar.scrollTop = sidebarScrollY;
            }
        }
        
        if (event.data?.type === 'getState' || event.data?.type === 'getScroll') {
            sendState();
        }
    });
    
    window.addEventListener('load', () => {
        attachListeners();
        setTimeout(sendState, 200);
    });
    
    if (document.readyState === 'complete' || document.readyState === 'interactive') {
        attachListeners();
    }
})();
</script>
"""
