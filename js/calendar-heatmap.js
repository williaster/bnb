var CalendarHeatmap = function(containerId) {
    var colors = ["#feebe2", "#fbb4b9", "#f768a1", "#c51b8a", "#7a0177"];
    var margin = { left: 15, right: 15 };
    var width  = 600 - margin.left - margin.right;
    var height = 95; // per chart!
    var cellSize = 10.5;

    var colorScale = d3.scale.quantize();
    var formatYear = d3.time.format("%Y");
    var formatDate = d3.time.format("%Y-%m-%d");

    var tooltipFormat = d3.time.format("%a %b %d");
    var dateAccessor  = function(d) { return d.key; };
    var valueAccessor = function(d) { return +d.value };

    var yearSvg, yearLabels, monthLabels, dowLabels, daysG, days, monthsG, months, legend, tooltip
    var data, dataByDate, dimension, group;

    var calendar = {}; // returned object

    // @TODO check whether labels are defined
    calendar.render = function() {

    };

    calendar.render = calendar.redraw = function() {
        if (!dimension || !group) console.warn("no dimension or group to plot");

        data = group.top(Infinity);

        dataByDate = d3.nest()
            .key(function(d) { return formatDate(dateAccessor(d)); })
            .rollup(function(d) { return valueAccessor(d[0]); })
            .map(data);

        var yearRange = d3.extent(data, function(d) { return +formatYear(dateAccessor(d)); });

        if (yearRange[0] === yearRange[1]) { // at least one year
            yearRange[1]++;
        }

        colorScale
            .range(colors)
            .domain(d3.extent(data, valueAccessor));

        // Svg for each year
        yearSvg = d3.select(containerId).selectAll("svg")
            .data(d3.range(yearRange[0], yearRange[1]));

        yearSvg.exit().remove();

        yearSvg.enter().append("svg")
            .attr("width", width + margin.left + margin.right)
            .attr("height", height)
            .attr("class", "year")
          .append("g")
            .attr("transform", "translate(" + margin.left + "," + (height - cellSize * 7 - 1) + ")");

        // all of the labels
        if (!yearLabels) {
            yearLabels = yearSvg.select("g")
              .append("text")
                .attr("transform", "translate(-6," + (cellSize * 3.5) + ")rotate(-90)")
                .style("text-anchor", "middle")
                .text(function(d) { return d; });
        }
        if (!dowLabels) {
            dowLabels = yearSvg.select("g")
              .append("g")
                .attr("class", "dow-label")
                .attr("transform", "translate(" + (width - 5) + ",0)")
                .selectAll("dow")
                .data(["M", "T", "W", "T", "F", "S", "S"])
              .enter().append("text")
                .attr("transform", function(d,i) { return "translate(0," + ((i + 1) * cellSize - 1) + ")"; })
                .style("text-anchor", "middle")
                .text(function(d) { return d; });
        }
        if (!monthLabels) {
            monthLabels = yearSvg.select("g")
              .append("g")
                .attr("class", "month-label")
                .selectAll("text")
                .data(["J", "F", "M", "A", "M", "J", "J", "A", "S", "O", "N", "D"])
              .enter().append("text")
                // this isn't a perfect translate...
                .attr("transform", function(d,i) { return "translate(" + (4.21 * (i + 0.5) * (width/52)) + ",-6)"; })
                .style("text-anchor", "middle")
                .text(function(d) { return d; });
        }

        // Each day
        if (!daysG) {
            daysG = yearSvg.select("g")
              .append("g")
                .attr("class", "day");
        }

        days = daysG.selectAll("rect")
            .data(function(d) { // all days for this year;
                return d3.time.days(new Date(d, 0, 1), new Date(d + 1, 0, 1)); // new Date(y, m, d)
            });

        days.exit().remove();

        days.enter().append("rect");

        days.attr("width",  cellSize)
            .attr("height", cellSize)
            .attr("x", function(d) { return d3.time.weekOfYear(d) * cellSize; })
            .attr("y", function(d) { return d.getDay() * cellSize; })
            .style("fill", "#fff")
            .datum(function(d) { return { date: d, string: formatDate(d) }; } );

        days.filter(function(d) { return d.string in dataByDate; })
            .style("fill", function(d) { return colorScale(dataByDate[d.string]); })
            .on("mouseover", function(d) {
                d3.select(this)
                    .attr("stroke-width", "2px")
                    .style("stroke", "#333");

                tooltip
                    .style("opacity", 1)
                    .style("left", (d3.event.pageX - 30) + "px")
                    .style("top", (d3.event.pageY - 4*cellSize) + "px")
                    .html(tooltipFormat(d.date) + "<br/>value: " + dataByDate[d.string]);
            })
            .on("mouseout", function(d) {
                tooltip.style("opacity", 0);

                d3.select(this)
                    .attr("stroke-width", "1px")
                    .style("stroke", null);
            });

        // Outline months
        if (!monthsG) {
            monthsG = yearSvg.select("g")
              .append("g") // group in a g
                .attr("class", "month");
        }

        months = monthsG.selectAll("path")
            .data(function(d) {  // all months for this year
                return d3.time.months(new Date(d, 0, 1), new Date(d + 1, 0, 1)); // new Date(y, m, d)
            });

        months.exit().remove();

        months.enter().append("path");

        months.attr("d", monthPath);

        // tooltip last / on top
        if (!tooltip) {
            tooltip = d3.select(containerId).append("div")
                .attr("class", "heatmap-tooltip")
                .style("opacity", 0);

            tooltip.append("text");
        }

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
