// also some css
var listingsColor     = "#0571b0";
var interactionsColor = "#d01c8b";
var heightSupplyCharts = 150;
var heightDemandCharts = 130;
var commaFormat = d3.format(",");

var overrideTimeDomain = [new Date("1/1/2013"), new Date("1/1/2015")];
var initialTimerange   = [new Date("12/1/2014"), new Date("1/1/2015")];
var supplyToggle, demandToggle,
    // demand
    map, byCapacity, byType, byInstant, byBedBath,
    // supply
    calendar, byNights, byGuests, timeToReply, timeToCheckin, pathSankey;

function initVis() {
    // Fetch data
    d3.csv("../../data/listings.csv", function(error, listingsRaw) {
        if (error) return console.error("listings error", error);

        d3.csv("../../data/interactions.csv", function(error, interactionsRaw) {
            var parsedData = mungeData(listingsRaw, interactionsRaw);

            d3.select(".loading").remove();
            d3.select(".vis").style("display", "block");

            makeVis(parsedData);
        });
    });
}
function handleSupplyDemandToggle(clicked) {
    var toToggle, toToggleButton, toTurnOff, toTurnOffButton;
    if (clicked === "supply") {
        toToggleButton  = d3.select(".listings-summary");
        toTurnOffButton = d3.select(".interactions-summary");
        toToggle  = d3.select(".supply");
        toTurnOff = d3.select(".demand");
    } else {
        toTurnOffButton  = d3.select(".listings-summary");
        toToggleButton   = d3.select(".interactions-summary")
        toTurnOff  = d3.select(".supply");
        toToggle = d3.select(".demand");
    }
    toToggleButton.classed("on", !toToggleButton.classed("on"));
    toToggle.classed("off", !toToggle.classed("off"));

    toTurnOffButton.classed("on", false);
    toTurnOff.classed("off", true);
};
// renders all charts
// @TODO just make list of charts to iteratea over + define update function (so can remove global vars using closure)
function makeVis(parsedData) {
    var listings     = parsedData.listings;
    var interactions = parsedData.interactions;

    supplyToggle = d3.select(".listings-summary")
        .on("click", function() { handleSupplyDemandToggle("supply"); });
    demandToggle = d3.select(".interactions-summary")
        .on("click", function() { handleSupplyDemandToggle("demand"); });

    // Supply side
    byCapacity = dc.barChart("#people-capacity")
        .width(200)
        .height(heightSupplyCharts - 30)
        .margins({top: 10, right: 10, bottom: 20, left: 35})
        .dimension(listings.dims.capacity)
        .group(listings.groups.capacity)
        .x( d3.scale
              .linear()
              .domain([0, 17]) )
        .elasticY(true)
        .gap(1)
        .centerBar(true)
        .round(function(v) { return dc.round.floor(v) + 0.5; })
        .alwaysUseRounding(true)

        .yAxisLabel('# New listings')

    byCapacity.yAxis().ticks(5)

    byType = dc.rowChart("#listing-type")
        .width(150)
        .height(heightSupplyCharts - 30)
        .margins({top: 10, right: 10, bottom: 20, left: 10})
        .dimension(listings.dims.type)
        .group(listings.groups.type)
        .elasticX(true)
        .on("filtered", function() { redrawDemand(parsedData); })
        .xAxis().ticks(3);


    byInstant = dc.rowChart("#instant-bookable")
        .width(75)
        .height(heightSupplyCharts - 30)
        .margins({top: 10, right: 15, bottom: 20, left: 10})
        .dimension(listings.dims.instantBookable)
        .group(listings.groups.instantBookable)
        .elasticX(true)
        .on("filtered", function() { redrawDemand(parsedData); })
        .xAxis().ticks(2);

    byBedBath = dc.barChart("#beds-and-baths")
        .width(155)
        .height(heightSupplyCharts - 30)
        .margins({top: 10, right: 15, bottom: 20, left: 30})
        .x(d3.scale.linear().domain([-1,10]))
        .elasticY(true)
        .gap(1)
        .centerBar(true)
        .round(function(v) { return dc.round.floor(v) + 0.5; })
        .alwaysUseRounding(true)
        .yAxisLabel("# New listings")
        .dimension(listings.dims.bedrooms)
        .group(listings.groups.bedrooms)
        .on("filtered", function() { redrawDemand(parsedData); })
              // .stack(listings.groups.bathrooms);

    byBedBath.yAxis().ticks(3);
    byBedBath.xAxis().ticks(4);

    // Demand side --------------------------------------------------
    calendar = CalendarHeatmap("#calendar-container")
        .dimension(interactions.dims.checkinDate)
        .group(interactions.groups.checkinDate);

    calendar.redraw();

    byNights = dc.barChart("#number-of-nights")
        .width(130)
        .height(heightDemandCharts - 30)
        .margins({top: 10, right: 10, bottom: 20, left: 50})
        .dimension(interactions.dims.nights)
        .group(interactions.groups.nights)
        .x( d3.scale
              .linear()
              .domain([0, 10]) )
        .elasticY(true)
        .gap(0)
        .centerBar(true)
        .round(function(v) { return dc.round.floor(v) + 0.5; })
        .alwaysUseRounding(true)
        .yAxisLabel('# Interactions')
        .on("filtered", function() { redrawSupply(parsedData); })

    byNights.xAxis().ticks(3)
    byNights.yAxis().ticks(4)

    byGuests = dc.barChart("#number-of-guests")
        .width(150)
        .height(heightDemandCharts - 30)
        .margins({top: 10, right: 10, bottom: 20, left: 40})
        .dimension(interactions.dims.guests)
        .group(interactions.groups.guests)
        .x( d3.scale
              .linear()
              .domain([0, 15]) )
        .elasticY(true)
        .gap(1)
        .centerBar(true)
        .round(function(v) { return dc.round.floor(v) + 0.5; })
        .alwaysUseRounding(true)
        .yAxisLabel('# Interactions')
        .on("filtered", function() { redrawSupply(parsedData); });

    byGuests.xAxis().ticks(5);
    byGuests.yAxis().ticks(4);

    timeToReply = dc.rowChart("#time-to-reply")
        .width(200)
        .height(heightDemandCharts - 30)
        .margins({top: 10, right: 10, bottom: 20, left: 10})
        .dimension(interactions.dims.timeToReply)
        .group(interactions.groups.timeToReply)
        .elasticX(true)
        .data(function(group) { return group.top(5); })
        .on("filtered", function() { redrawSupply(parsedData); })
        .xAxis().ticks(5)

    timeToCheckin = dc.barChart("#time-to-checkin")
    timeToCheckin.width(250)
        .height(heightDemandCharts - 30)
        .margins({top: 10, right: 10, bottom: 20, left: 40})
        .dimension(interactions.dims.daysInAdvanceRequested)
        .group(interactions.groups.daysInAdvanceRequested)
        .x( d3.scale
              .linear()
              .domain([-1, 35]) )
        .elasticY(true)
        // .elasticX(true)
        .gap(1)
        .centerBar(true)
        .round(function(v) { return dc.round.floor(v) + 0.5; })
        .alwaysUseRounding(true)
        .yAxisLabel('# Interactions')
        .on("filtered", function() { redrawSupply(parsedData, false, true); });

    timeToCheckin.xAxis().ticks(5);
    timeToCheckin.yAxis().ticks(4);


    dc.renderAll();

    map = MapChart("#map-container")
        .width(500)
        .height(330)
        .key(function(d) { return d.key; })
        .location(function(d) { return d.key; })
        .radius(function(d) { return +d.value; });

    d3.select("#map-container")
        .datum(listings.groups.location.top(Infinity))
        .call(map);

    // Path analysis
    pathSankey = SankeyPath("#path-analysis")
        .width(800)
        .height(150)

    d3.select("#path-analysis")
        .datum(parsedData.paths)
        .call(pathSankey);

    // timeline updates data, call last
    makeTimeline(parsedData);
};

// Creates the event timeline and sets up callbacks for brush changes
function makeTimeline(parsedData) {
    var listings     = parsedData.listings;
    var interactions = parsedData.interactions;

    var isZoomed = false; // track status
    var data = formatDataForTimeline(listings, interactions);
    var filteredData; // on zoom

    var container           = d3.select("#timeline");
    var dateRange           = d3.select(".date-summary");
    var listingsSummary     = d3.select(".listings-summary");
    var interactionsSummary = d3.select(".interactions-summary");

    var zoomToggle = d3.select("#timeline .zoom")
        .html("Zoom")
        .on("click", zoomOrResetTimeline);

    var timeline = fancyLineChart('#timeline')
        .width(700)
        .height(100)
        .xAccessor(function(d) { return +d.key})
        .yAccessor(function(d) { return +d.value })
        .y2Accessor(function(d) { return +d.value })
        .axisY({ title: "# New Listings", titleClass: "y-label listings-color" })
        .axisY2({ title: "# Guest-Host Intrxns", titleClass: "y-label interactions-color" })
        .onBrushed(onBrush);

    timeline.xAxis().ticks(5);
    timeline.yAxis().ticks(5);
    timeline.y2Axis().ticks(5);

    d3.select("#timeline")
        .datum(data)
        .call(timeline);

    timeline.brush()
        .extent(initialTimerange);

    timeline.svg.select(".brush")
        .call(timeline.brush());

    onBrush(); // emit an event

    function onBrush(brush, brushG) {
        brush = brush || timeline.brush();

        var extent = brush.extent()
            .map(d3.time.day.round); // snap selection to days

        // Filter data
        // data for supply side
        listings.dims
            .dateCreated.filter(extent);

        // data for demand side
        interactions.dims
            .firstInteraction.filter(extent);

        // title for date range
        dateRange.html(formatDateRange(extent, brush.empty()));

        // listing / interaction counts
        listingsSummary.html(getListingsSummary(parsedData, extent, brush.empty()));
        interactionsSummary.html(getInteractionsSummary(parsedData, extent, brush.empty()));

        // path analysis
        pathSankey.update(
            parsedData.filterPathAnalysisByDateRange(brush.extent())
        );

        redrawAll(parsedData);

        // Update status of zoom button
        if (brush.empty()) {
            zoomToggle.style("visibility", "hidden");
            timeline.updateChart(data);
        }
        else {
            zoomToggle.style("visibility", null);
        }
    }

    // Formats for reusable linechart { name: string, values: [object] }
    function formatDataForTimeline(listings, interactions) {
        var listingsGroup = listings.groups.dateCreated
            .top(Infinity)
            .sort(function(a,b) { return a.key - b.key; });

        var listingsData = {
            name: "new listings",
            color: listingsColor,
            axis: 0,
            values: listingsGroup.filter(function(d) {
                return d.key >= overrideTimeDomain[0] && d.key <= overrideTimeDomain[1];
            })
        };

        var interactionsGroup = interactions.groups.firstInteraction
            .top(Infinity)
            .sort(function(a,b) { return a.key - b.key; });

        var interactionsData = {
            name: "interactions",
            color: interactionsColor,
            axis: 1,
            values: interactionsGroup.filter(function(d) {
                return d.key >= overrideTimeDomain[0] && d.key <= overrideTimeDomain[1];
            })
        };

        var data = [listingsData, interactionsData];

        return data;
    };

    function zoomOrResetTimeline() {
        var brush = timeline.brush();
        filterToTimeRange(brush.extent());

        timeline.svg.select(".brush")
            .call(brush.clear());
    };

    function filterToTimeRange(extent) {
        filteredData = [];

        data.forEach(function(group) {
            var values = group.values.filter(function(d) {
                return d.key >= extent[0] && d.key <= extent[1];
            });
            filteredData.push(Object.assign({}, group, { values }));
        });

        zoomToggle.style("visibility", "hidden");
        timeline.updateChart(filteredData);
    };

    function formatDateRange(range, isEmpty) {
        if (isEmpty) {
            return "Select time range";
        }
        var format = d3.time.format("%a %b %d %Y");
        return "Showing data for <span class='emph'>" + format(range[0]) +
               "</span> &ndash; <span class='emph'>" + format(range[1]) + "</span>";
    };

    function getListingsSummary(parsedData, extent, isEmpty) {
        if (isEmpty) {
            return "<div>-- new listings</div>";
        }
        var monthInMs    = (1000*60*60*24*30);
        var offsetExtent = [new Date(extent[0] - monthInMs), new Date(extent[1] - monthInMs)];
        var listings     = parsedData.listings.groups.dateCreated.all();
        var curr;
        var count = 0;
        var countOffset = 0;
        var percentChange;
        // iterate over cross filter which is already keyed on days ...
        for (var i = 0, len = listings.length; i < len; i++) {
            curr = listings[i];
            if (curr.key >= extent[0] && curr.key <= extent[1]) {
                count += curr.value;
            }
            if (curr.key >= offsetExtent[0] && curr.key <= offsetExtent[1]) {
                countOffset += curr.value;
            }
        }
        percentChange = (count - countOffset) / countOffset * 100;
        percentChange = isNaN(percentChange) ? "-" : Math.round(percentChange*100) / 100;
        var arrow = "<span class='glyphicon glyphicon-arrow-" +
                    (percentChange > 0 ? "up" : "down") + "'></span>";

        return "<div>" +
                    "<span class='emph'>" + commaFormat(count) + "</span> new listings" +
               "</div>" +
               "<div class='summary-change'>" +
                    arrow + "<span class='emph'>" + Math.abs(percentChange) + "%</span> from " + commaFormat(countOffset) +
               "</div>";
    };
    function getInteractionsSummary(parsedData, extent, isEmpty) {
        if (isEmpty) {
            return "<div>-- interactions</div>";
        }
        var monthInMs    = (1000*60*60*24*30);
        var offsetExtent = [new Date(extent[0] - monthInMs), new Date(extent[1] - monthInMs)];
        var interactions = parsedData.interactions.groups.firstInteraction.all();
        var curr;
        var count = 0;
        var countOffset = 0;
        var percentChange;
        // iterate over cross filter which is already keyed on days ...
        for (var i = 0, len = interactions.length; i < len; i++) {
            curr = interactions[i];
            if (curr.key >= extent[0] && curr.key <= extent[1]) {
                count += curr.value;
            }
            if (curr.key >= offsetExtent[0] && curr.key <= offsetExtent[1]) {
                countOffset += curr.value;
            }
        }
        percentChange = (count - countOffset) / countOffset * 100;
        percentChange = isNaN(percentChange) ? "-" : Math.round(percentChange*100) / 100;
        var arrow = "<span class='glyphicon glyphicon-arrow-" +
                    (percentChange > 0 ? "up" : "down") + "'></span>";

        return "<div>" +
                   "<span class='emph'>" + commaFormat(count) + "</span> interactions " +
               "</div>" +
               "<div class='summary-change'>" +
                    arrow + "<span class='emph'>" + Math.abs(percentChange) + "%</span> from " + commaFormat(countOffset) +
               "</div>";
    };

};

function redrawAll(parsedData) {
    redrawDemand(parsedData, false);
    redrawSupply(parsedData, false);
    dc.redrawAll();
};

function redrawDemand(parsedData, updateDc) {
    map.updatePoints(
        parsedData.listings.groups.location.top(Infinity)
    );
    if (updateDc) {
        dc.redrawAll();
    }
};


function redrawSupply(parsedData, updateDc, doNotUpdateCheckin) {
    // Have to manually update the x axis ...
    function getMaxTimeToCheckin() {
        var top = parsedData.interactions.dims.daysInAdvanceRequested.top(3)[2]; // outliers
        var firstInteraction = d3.time.day(parsedData.yearMonthDayHourMinuteSecond(top.first_interaction_time_utc));
        var checkinDate      = parsedData.yearMonthDay(top.checkin_date);
        return (checkinDate - firstInteraction) / (1000*60*60*24);
    };
    if (!doNotUpdateCheckin) {
        timeToCheckin
            .x(d3.scale.linear()
            .domain([-1, getMaxTimeToCheckin() + 1]));
    }

    timeToCheckin.redraw();
    calendar.redraw();

    if (updateDc) {
        dc.redrawAll();
    }
};