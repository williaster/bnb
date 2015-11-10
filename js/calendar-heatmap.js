var CalendarHeatmap = function(containerId) {
    var colors = ["#feebe2", "#fbb4b9", "#f768a1", "#c51b8a", "#7a0177"];
    var margin = { left: 15, right: 15 };
    var width  = 600 - margin.left - margin.right;
    var height = 95; // per chart!
    var cellSize = 10.5;

    var colorScale = d3.scale.quantize();
    var formatYear = d3.time.format("%Y");
    var formatDate = d3.time.format("%Y-%m-%d");

    var dateAccessor  = function(d) { return d.key; };
    var valueAccessor = function(d) { return +d.value };

    // note scales are for the brush only
    var brush = d3.svg.brush()
        .x(d3.scale.identity().domain([margin.left, width + 2]))
        .y(d3.scale.identity().domain([height - (cellSize * 7) - 1, (2 * height) - (cellSize * 7) - 1]))
        .on("brushend", onBrush);

    function onBrush() {
        var extent = d3.event.target.extent();
        var weekLow  = Math.floor((extent[0][0] - margin.left) / cellSize);
        var weekHigh = Math.ceil((extent[1][0] - margin.left) / cellSize);
        var dayLow   = Math.floor((extent[0][1] - 20.5) / cellSize);
        var dayHigh  = Math.ceil((Math.min(height, extent[1][1]) - 20.5) / cellSize);
        // d3.select(this).transition()
          // .call(brush.extent(extent1))
          // .call(brush.event);
    };

    var dimension, group, legend;

    var calendar = {}; // returned object

    // @TODO check whether labels are defined
    calendar.render = calendar.redraw = function() {
        if (!dimension || !group) console.warn("no dimension or group to plot");

        var data = group.top(Infinity);

        var dataByDate = d3.nest()
            .key(function(d) {
                return formatDate(dateAccessor(d));
            })
            .rollup(function(d) {
                return valueAccessor(d[0]);
            })
            .map(data);

        var yearRange = d3.extent(data, function(d) { return +formatYear(dateAccessor(d)); });

        if (yearRange[0] === yearRange[1]) {
            yearRange[1]++;
        }

        colorScale
            .range(colors)
            .domain(d3.extent(data, valueAccessor));

        // Each year
        var yearSvg = d3.select(containerId).selectAll("svg")
            .data(d3.range(yearRange[0], yearRange[1]))

        yearSvg.exit().remove();

        yearSvg.enter().append("svg")
            .attr("width", width + margin.left + margin.right)
            .attr("height", height)
            .attr("class", "year")
          .append("g")
            .attr("transform", "translate(" + margin.left + "," + (height - cellSize * 7 - 1) + ")");

        var yearLabel = yearSvg.select("g").append("text")
            .attr("transform", "translate(-6," + (cellSize * 3.5) + ")rotate(-90)")
            .style("text-anchor", "middle")
            .text(function(d) { return d; })

        var dowLabels = yearSvg.select("g")
          .append("g")
            .attr("class", "dow label")
            .attr("transform", "translate(" + (width - 5) + ",0)")
            .selectAll("dow")
            .data(["M", "T", "W", "T", "F", "S", "S"])
          .enter().append("text")
            .attr("transform", function(d,i) { return "translate(0," + ((i + 1) * cellSize - 1) + ")"; })
            .style("text-anchor", "middle")
            .text(function(d) { return d; });

        yearSvg.call(brush);

        // Each day
        var days = yearSvg.select("g").selectAll(".day")
            .data(function(d) { // all days for this year;
                return d3.time.days(new Date(d, 0, 1), new Date(d + 1, 0, 1)); // new Date(y, m, d)
            });

        days.exit().remove();

        days.enter().append("rect");

        days.attr("class", "day")
            .attr("width",  cellSize)
            .attr("height", cellSize)
            .attr("x", function(d) { return d3.time.weekOfYear(d) * cellSize; })
            .attr("y", function(d) { return d.getDay() * cellSize; })
            .style("fill", "#fff")
            .datum(formatDate);

        days.filter(function(d) {
                return d in dataByDate;
            })
            .style("fill", function(d) {
                return colorScale(dataByDate[d]);
            })
            .on("mouseover", function(d) { console.log("d:", d, "count:", dataByDate[d]) });

        // Outline months
        var months = yearSvg.select("g").selectAll(".month")
            .data(function(d) {  // all months for this year
                return d3.time.months(new Date(d, 0, 1), new Date(d + 1, 0, 1)); // new Date(y, m, d)
            });

        months.exit().remove();

        months.enter().append("path")
            .attr("class", "month");

        months.attr("d", monthPath);

        var monthLabels = yearSvg.select("g")
          .append("g")
            .attr("class", "month label")
            .selectAll("text")
            .data(["J", "F", "M", "A", "M", "J", "J", "A", "S", "O", "N", "D"])
          .enter().append("text")
            .attr("transform", function(d,i) { return "translate(" + (4.21 * (i + 0.5) * (width/52)) + ",-6)"; })
            .style("text-anchor", "middle")
            .text(function(d) { return d; });


        return this;
    };

    // Helpers
    function monthPath(t0) {
        var t1 = new Date(t0.getFullYear(), t0.getMonth() + 1, 0),
            d0 = t0.getDay(), w0 = d3.time.weekOfYear(t0),
            d1 = t1.getDay(), w1 = d3.time.weekOfYear(t1);
        return "M" + (w0 + 1) * cellSize + "," + d0 * cellSize +
               "H" + w0 * cellSize + "V" + 7 * cellSize +
               "H" + w1 * cellSize + "V" + (d1 + 1) * cellSize +
               "H" + (w1 + 1) * cellSize + "V" + 0 +
               "H" + (w0 + 1) * cellSize + "Z";
    }

    // getter/setters
    calendar.dimension = function(_) {
        if (typeof _ === "undefined") return dimension;
        dimension = _;
        return calendar;
    };
    calendar.group = function(_) {
        if (typeof _ === "undefined") return group;
        group = _;
        return calendar;
    };
    calendar.width = function(_) {
        if (typeof _ === "undefined") return width;
        width = _;
        return calendar;
    }

    return calendar;
}
