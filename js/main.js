// Variables for the visualization instances
let barchart;
let canadaVis;


// Start application by loading the data
loadData();

function loadData() {
    d3.csv("data/med-data-sheet.csv"). then(csvData => {

        // prepare data
        let data = prepareData(csvData);
        console.log('data loaded');

        barchart = new BarChartVis('chart-area', data);
        barchart.initVis();
        // document.getElementById("submit-info").addEventListener(
        //     "click", () => barchart.updateVis()
        // );

        canadaVis = new CanadaMapVisualization(
            null,
            data,
            d3.json("data/canada_provinces.geojson")
        );
        canadaVis.click_callback = (d) => {
            canadaVis.updateVisPublic();
        }
        canadaVis.initVis();
    });
}

function UpdateVisuals() {
    barchart.updateVis();
    canadaVis.updateVisPublic();
}

function prepareData(data) {
    return data;
}

function updateSliderValue(elementID, value) {
    document.getElementById(elementID).textContent = value;
}

document.getElementById("gpa-slider").addEventListener(
    "input",
    (event) => updateSliderValue(
        "gpa-slider-label",
        document.getElementById("gpa-slider").value
        )
);

document.getElementById("gpa-slider").addEventListener(
    "change",
    (event) => UpdateVisuals()
);

document.getElementById("canadian-citizen").addEventListener(
    "change",
    (event) => UpdateVisuals()
);

document.getElementById("taken-casper").addEventListener(
    "change",
    (event) => UpdateVisuals()
);

document.getElementById("Chem/Phys").addEventListener(
    "change",
    (event) => UpdateVisuals()
);

document.getElementById("Bio/Biochem").addEventListener(
    "change",
    (event) => UpdateVisuals()
);

document.getElementById("Psych/Soc").addEventListener(
    "change",
    (event) => UpdateVisuals()
);

document.getElementById("CARS").addEventListener(
    "change",
    (event) => UpdateVisuals()
);



// Sidebar form behavior with collapse/drawer + validation + autosave draft
// Updated so the sidebar does NOT stay collapsed across page reloads.
// The collapsed state is no longer persisted; on load the sidebar is left expanded.

(function () {
    const sidebar = document.getElementById('sidebar');
    const collapseBtn = document.getElementById('collapseBtn');
    const sidebarToggle = document.getElementById('sidebarToggle');
    const overlay = document.getElementById('overlay');

    let collapsed = false;

    function isSmallScreen() {
        return window.matchMedia('(max-width: 820px)').matches;
    }

    function updateCollapseButtonUI() {
        // show a right-pointing arrow when collapsed, left when expanded
        if (collapsed) {
            collapseBtn.textContent = '▶';
            collapseBtn.setAttribute('aria-label', 'Expand sidebar');
            collapseBtn.setAttribute('aria-expanded', 'false');
        } else {
            collapseBtn.textContent = '◀';
            collapseBtn.setAttribute('aria-label', 'Collapse sidebar');
            collapseBtn.setAttribute('aria-expanded', 'true');
        }
    }

    // Do NOT persist collapse state across reloads. Default persist=false.
    function applyCollapsedState(shouldCollapse, persist = false) {
        collapsed = Boolean(shouldCollapse);
        if (collapsed) {
            sidebar.classList.add('collapsed');
        } else {
            sidebar.classList.remove('collapsed');
        }
        updateCollapseButtonUI();
        // intentionally do NOT write to localStorage so reload leaves sidebar expanded
        // if persist were true we might write, but by default we don't.
    }

    // Desktop: toggle collapse (keeps arrow visible)
    collapseBtn.addEventListener('click', (e) => {
        // On small screens treat the button as a "close" for the drawer
        if (isSmallScreen()) {
            if (sidebar.classList.contains('open')) closeDrawer();
            else openDrawer();
            return;
        }
        applyCollapsedState(!collapsed);
    });

    // Topbar button: opens sidebar on small screens, toggles collapse on larger screens
    sidebarToggle.addEventListener('click', () => {
        if (isSmallScreen()) openDrawer();
        else applyCollapsedState(!collapsed);
    });

    // Overlay click closes the drawer
    overlay.addEventListener('click', closeDrawer);

    function openDrawer() {
        sidebar.classList.add('open');
        overlay.hidden = false;
        overlay.style.opacity = '1';
        sidebarToggle.setAttribute('aria-expanded', 'true');
        const first = sidebar.querySelector('input, select, textarea, button');
        if (first) first.focus();
    }

    function closeDrawer() {
        sidebar.classList.remove('open');
        overlay.style.opacity = '0';
        overlay.hidden = true;
        sidebarToggle.setAttribute('aria-expanded', 'false');
        sidebarToggle.focus();
    }

    // Escape behavior
    document.addEventListener('keydown', (ev) => {
        if (ev.key === 'Escape') {
            if (isSmallScreen() && sidebar.classList.contains('open')) closeDrawer();
            else if (!isSmallScreen() && collapsed) applyCollapsedState(false);
        }
    });

    // On load: always start uncollapsed (expanded). Do not read any persisted collapse flag.
    window.addEventListener('load', () => {
        applyCollapsedState(false, false); // explicitly expanded, no persistence
        overlay.hidden = true;
    });

    // Resize behavior
    let previousSmall = isSmallScreen();
    window.addEventListener('resize', () => {
        const nowSmall = isSmallScreen();
        if (nowSmall && !previousSmall) {
            sidebar.classList.remove('open');
            overlay.hidden = true;
        } else if (!nowSmall && previousSmall) {
            sidebar.classList.remove('open');
            overlay.hidden = true;
        }
        previousSmall = nowSmall;
    });

})();