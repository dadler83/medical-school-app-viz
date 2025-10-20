// Variables for the visualization instances
let barchart;


// Start application by loading the data
loadData();

function loadData() {
    d3.csv("data/med-data-sheet.csv"). then(csvData => {

        // prepare data
        let data = prepareData(csvData);
        console.log('data loaded');

        barchart = new BarChartVis('chart-area', data);
        barchart.initVis();
        document.getElementById("submit-info").addEventListener(
            "click", () => barchart.updateVis()
        );
    });
}

function prepareData(data) {
    return data;
}

function updateSliderValue(elementID, value) {
    document.getElementById(elementID).textContent = value;
}

document.getElementById("gpa-slider").addEventListener(
    "change",
    (event) => updateSliderValue(
        "gpa-slider-label",
        document.getElementById("gpa-slider").value
        )
);