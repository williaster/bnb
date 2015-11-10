/*
 * Re-usable fancy d3 linechart.
 * Different views should be able to create instances of this chart and customize
 * its behavior with accessor functions and attributes, accessible via public getters,
 * and setters (defined in public API section at end of file)
 *
 * Should be called on a d3 selection with data (see bost.ocks.org/mike/chart/)
 * (this module essentially defines a closure chart function object with getter/setters for customization)
 *
 * Expected data format (array of data objects, one for each line, with array of values for that line):
 *  [ { name: "", values: [ {}, ... ] }, ... ]
 */

var classes = {
    chart:             "fancy-linechart",
    groups:            "group",
    area:              "confidence-area",
    line:              "linechart-line",
    point:             "dot",
    overlay:           "linechart-overlay",
    axis:              "axis",
    xAxis:             "x axis",
    xLabel:            "x-label",
    yAxis:             "y axis",
    yLabel:            "y-label",
    tooltip:           "tooltip-container",
    brush:             "brush",
    mouseEvents:       "mouse-event-layer",
    voronoi:           "voronoi",
    clipped:           "clipped",
    userAddedLines:    ""
};

var fancyLineChart= function(container) {
    // Private variables some of which have getter/setters
    var initialized = false;
    var containerId = typeof container === "string" ?
                      container : (container.getAttribute("Id") || Math.floor(Math.random() * 10e8));
    var margin = { top: 10, right: 50, bottom: 20, left: 45 }; // nb: axes labels should be placed with vals < applicable margins
    var width  = 960 - margin.left - margin.right;
    var height = 500 - margin.top  - margin.bottom;
    var focusStrokeWidth = 3;
    var focusOpacity     = 0.25;
    var lineInterpolator = "linear"; // any valid d3 interpolator, e.g., "cardinal" or null or "step-before"
    var areaInterpolator = lineInterpolator;

    // Accessor functions
    var isDefined      = function(d) { return d && !isNaN(String(xAccessor(d))) && !isNaN(String(yAccessor(d))); };
    var xAccessor      = function(d) { return d.x; };
    var yAccessor      = function(d) { return d.y; };
    var colorAccessor  = function(d) { return d.color || "#000"; };
    var fillAccessor   = function(d) { return d.fill  || colorAccessor(d); };
    var radiusAccessor = function(d) { return d.radius || 2; };

    // these are optional accessors. if defined by setters they add additional functionality to the chart
    var onMouseMove;
    var onMouseOut;
    var onClick;
    var dashTypeAccessor;
    var yConfidenceAccessor;
    var y2Accessor; // secondary y-axis
    var onBrushed;
    var userAddedLines = {};

    // Axis-related things
    var xScale  = d3.time.scale();
    var yScale  = d3.scale.linear();
    var y2Scale = d3.scale.linear();
    var xAxis   = d3.svg.axis().scale(xScale).orient("bottom");
    var yAxis   = d3.svg.axis().scale(yScale).orient("left");
    var y2Axis  = d3.svg.axis().scale(y2Scale).orient("right");
    var brush, brushG; // brush obj if onBrushed defined
    var xAxisHandle, yAxisHandle, y2AxisHandle; // actual svg objs

    // the following are objects that define relevant axes / tooltip attributes
    var axisX = {
        axisClass:  classes.xAxis,
        titleClass: classes.xLabel,
        x: function () { return width / 2; },
        y: 30,
        dy: ".71em",
        textAnchor: "middle",
        title: "",
        formatter: undefined,
        margin: 5
    };

    var axisY = {
        axisClass:  classes.yAxis,
        titleClass: classes.yLabel,
        x: function () { return -height / 2; },
        y: -45,
        dy: ".71em",
        textAnchor: "middle",
        title: "",
        formatter: undefined,
        limits: { min: undefined, max: undefined, symmetric: false },
        margin: 5
    };

    var axisY2 = {
        axisClass:  classes.yAxis + " secondary",
        titleClass: classes.yLabel,
        x: function () { return +height / 2; },
        y: -45,
        dy: ".71em",
        textAnchor: "middle",
        title: "",
        formatter: undefined,
        limits: { min: undefined, max: undefined, symmetric: false },
        margin: 5
    };

    var tooltip  = {
        class: classes.tooltip,
        div: undefined
    };

    // path generators and other global vars (global for updating)
    var lineGen, lineGen2, areaGen, voronoiGen, userAddedLineGen;
    var svg, clipped, groups, confidenceIntervals, lines, lines2, points, mouseEvents, voronoiGroup, voronoiPaths;

    // this is the returned chart function / object
    // calling it actually makes the chart, and should be done after all getter/setters are called
    function chart(selection) {
        initialized = true;

        // An invisible Voronoi tessellation is used to find the closest point for all mouse events
        // see http://bl.ocks.org/mbostock/8033015, you can toggle visibility in the css
        voronoiGen = d3.geom.voronoi()
                .x(function(d) { return xScale( xAccessor(d) ); })
                .y(function(d) { return yScale( yAccessor(d) ); })
                .clipExtent([[0,0], [width, height]]);

        if (!lineGen) {
            lineGen = d3.svg.line()
                .defined(isDefined)
                .interpolate(lineInterpolator)
                .x(function(d) { return xScale(xAccessor(d)); })
                .y(function(d) { return yScale(yAccessor(d)); });
        }
        if (!lineGen2 && y2Accessor) { // secondary y-axis
            lineGen2 = d3.svg.line()
                .defined(isDefined)
                .interpolate(lineInterpolator)
                .x(function(d) { return xScale(xAccessor(d)); })
                .y(function(d) { return y2Scale(y2Accessor(d)); });
        }
        if (!areaGen && yConfidenceAccessor) { // n/a if no confidence accessor
            areaGen = d3.svg.area()
                .defined(isDefined)
                .x(function(d)  { return xScale( xAccessor(d) ); })
                .y0(function(d) { return yScale( yAccessor(d) - yConfidenceAccessor(d) ); })
                .y1(function(d) { return yScale( yAccessor(d) + yConfidenceAccessor(d) ); })
                .interpolate(areaInterpolator);
        }
        if (onBrushed) {
            brush = d3.svg.brush()
                .x(xScale)
                .on("brushend", onBrushed);
        }
        if (!userAddedLineGen) { // in contrast to lineGen, asssumes no accessor needed for x/y vals
            userAddedLineGen = d3.svg.line()
                .interpolate("linear")
                .x(function(d) { return xScale(d[0]); })
                .y(function(d) { return yScale(d[1]); });
        }

        selection.each(function (data, index) {

            svg = chart.svg = d3.select(this).append("svg")
                .attr("class", classes.chart)
                .attr("width",  width + margin.left + margin.right)
                .attr("height", height + margin.top + margin.bottom)
              .append("g")
                .attr("transform", "translate(" + margin.left + "," + margin.top + ")");

            xAxisHandle = svg.append("g")
                .attr("class", axisX.axisClass)
                .attr("transform", "translate(0," + height + ")");
            xAxisHandle.append("text")
                .attr("class", axisX.titleClass)
                .attr("x", axisX.x)
                .attr("y", axisX.y)
                .attr("dy", axisX.dy)
                .style("text-anchor", axisX.textAnchor)
                .html(axisX.title);

            yAxisHandle = svg.append("g")
                .attr("class", axisY.axisClass);
            yAxisHandle.append("text")
                .attr("class", axisY.titleClass)
                .attr("transform", "rotate(-90)")
                .attr("x", axisY.x)
                .attr("y", axisY.y)
                .attr("dy", axisY.dy)
                .style("text-anchor", axisY.textAnchor)
                .html(axisY.title);

            if (y2Accessor) {
                y2AxisHandle = svg.append("g")
                    .attr("class", axisY2.axisClass)
                    .attr("transform", "translate(" + width + ",0)");;

                y2AxisHandle.append("text")
                    .attr("class", axisY2.titleClass)
                    .attr("transform", "rotate(+90)")
                    .attr("x", axisY2.x)
                    .attr("y",  axisY2.y)
                    .attr("dy", axisY.dy)
                    .style("text-anchor", axisY2.textAnchor)
                    .html(axisY2.title);
            }

            // Create clip path to keep data inside axis boundaries
            // bottom to top: confidence intervals, lines, points
            // (tooltips, axes, etc shouldn't go in this)
            svg.append("clipPath")
                .attr("id", containerId + "-clip")
                .append("rect")
                .attr("x", -axisX.margin)
                .attr("y", -axisY.margin)
                .attr("width", width + (2 * axisX.margin))
                .attr("height", height + (2 * axisY.margin));

            clipped = chart.clipped = svg.append("g")
                .attr("class", classes.clipped)
                .attr("clip-path", "url(" + (containerId[0] === "#" ? "" : "#") + containerId + "-clip)");

            // Create layer to capture then handle all mouse events
            // bottom to top: brush (if applicable), voronoi layer
            mouseEvents = svg.append("g")
                .attr("class", classes.mouseEvents);

            if (brush) {
                brushG = mouseEvents.append("g")
                    .attr("class", classes.brush)
                    .attr("pointer-events", "none")

                callBrush();
            }

            // only way I could get mouse events to work properly was to add
            // voronoi on top of brush layer, in the same g object! see this example:
            // http://bl.ocks.org/musically-ut/4747894
            voronoiGroup = (brush ? brushG : mouseEvents).append("g")
                .attr("class", classes.voronoi);

            tooltip.div = d3.select(this).append("div")
                .attr("class", tooltip.class);

            chart.updateChart(data);

            chart.toggleGroup = function(name) {
                var datum = getDataForName(data, name);

                if (datum && datum.visible !== false) {
                    datum.visible = false;
                    datum.g.style("display", datum.display = "none");
                }
                else if (datum) {
                    datum.visible = true;
                    datum.g.style("display", datum.display = null);
                }
                chart.updateChart(data);
            };

            chart.toggleFocus = function(name) {
                var elems = getGroup(data, name, /*elemsOnly=*/true);

                if (elems && elems.area.node()) {
                    var currOpacity  = +elems.area.style("opacity");
                    elems.area.style("opacity", Math.abs(currOpacity - focusOpacity) < 0.01 ? null : focusOpacity)
                }
                if (elems && elems.line.node()) {
                    var currStrokeWidth = +elems.line.style("stroke-width").slice(0, -2);
                    elems.line.style("stroke-width", Math.abs(currStrokeWidth - focusStrokeWidth) < 0.01 ? null : (focusStrokeWidth + "px"))
                }
            };
        });
    };

    // The following functions create / update specific parts of the chart.
    // It is broken out this way so that axes and data points can be updated (eg when toggling visibility)
    function callAxes(data) {
        xScale.domain([
            d3.min(data, function(group) {
                return group.display !== "none" ? d3.min(group.values, xAccessor) : Infinity;
            }),
            d3.max(data, function(group) {
                return group.display !== "none" ? d3.max(group.values, xAccessor) : -Infinity;
            }) ])
            .rangeRound([0, width])
            .clamp(true);

        yScale.domain( getYDomain(data, yAccessor, yConfidenceAccessor, axisY, /*axis=*/0) )
            .rangeRound([height, 0])
            .nice(axisY.ticks)
            .clamp(true);

        xAxisHandle.call(xAxis);
        yAxisHandle.call(yAxis);

        if (y2Accessor) {
            y2Scale.domain( getYDomain(data, y2Accessor, yConfidenceAccessor, axisY, /*axis=*/1) )
                .rangeRound([height, 0])
                .nice(axisY.ticks);

            y2AxisHandle.call(y2Axis);
        }
    };
    function makeGroups(data) {
        groups = clipped.selectAll("." + classes.groups).data(data);

        // exit enter update pattern
        groups.exit().transition().duration(200).remove();
        groups.enter().append("g");
        groups.attr("class", function(d) {
            d.g = d3.select(this);
            return classes.groups;
        });

        if (yConfidenceAccessor) {
            if (!confidenceIntervals) {
                confidenceIntervals = groups.append("path")
                    .attr("class", classes.area)
                    .attr("fill", fillAccessor);
            }
            confidenceIntervals.transition().duration(200)
                .attr("d", function(d) {
                    return d.visible !== false ? areaGen(d.values) : "";
                });
        }

        if (lineInterpolator !== null) {
            if (!lines) {
                lines = groups.append("path")
                    .attr("class", classes.line)
                    .attr("stroke", colorAccessor)
            }
            lines.transition().duration(200)
                .attr("d", function(d) {
                    return d.visible !== false && (typeof d.axis === "undefined" || d.axis === 0) ?
                           lineGen(d.values) : null;
                });
        }
        if (y2Accessor) {
            if (!lines2) {
                lines2 = groups.append("path")
                    .attr("class", classes.line)
                    .attr("stroke", colorAccessor);
            }
            lines2.transition().duration(200)
                .attr("d", function(d) {
                    return d.visible !== false && d.axis === 1 ?
                           lineGen2(d.values) : null;
                });
        }

        // points for each line
        // points = groups.selectAll("circle")
        //     .data(function(d) {
        //         if (d.visible !== false) {
        //             return d.values.filter(isDefined)
        //         }
        //         return [];
        //     });

        // // exit enter update pattern
        // points.exit().transition().duration(200).remove();
        // points.enter().append("circle");
        // points.attr("class", classes.point)
        //     .style("fill", fillAccessor)
        //     .attr("r", radiusAccessor)
        //   .transition().duration(200)
        //     .attr("cx", function(d) { return xScale( xAccessor(d) ); })
        //     .attr("cy", function(d) { return yScale( yAccessor(d) ); })

    };
    function callBrush() {
        brushG.call(brush)
            .selectAll("rect")
            .attr("height", height);
    };
    function makeMouseEventLayer(data) {
        if (onMouseMove || onMouseOut) { // use voronoi
            var dataForVoronoi = d3.nest()
                .key(function(d) { return xScale( xAccessor(d) ) + "," + yScale( yAccessor(d) ); }) // key on scaled x,y vals
                .rollup(function(v) { return v[0]; })
                .entries(d3.merge(data.map(function(group, i) { // concat all values
                    group.values.forEach(function(d) {
                        d.dataIdx = i; // add idx for easily finding lines and points for given point
                    });                // other functionality depends on this being there
                    return group.visible !== false ? group.values : [];
                })))
                .map(function(group) { return group.values; });

            voronoiPaths = voronoiGroup.selectAll("path").data(voronoiGen( dataForVoronoi ));

            voronoiPaths.exit().remove();
            voronoiPaths.enter().append("path");
            voronoiPaths
                .attr("d", function(d) { return "M" + d.join("L") + "Z"; }) // creates svg polygon paths
                .datum(function(d) { return d.point; }); // defines the data returned to listeners,
                                                        // here the point object (defined in dataForVoronoi) closest to this voronoi

            voronoiPaths.on("mousemove", function(d) {
                onMouseMove(d, data[d.dataIdx].line, data[d.dataIdx].area);
            });
            voronoiPaths.on("mouseout", function(d) {
                onMouseOut(d, data[d.dataIdx].line, data[d.dataIdx].area);
            });

            if (brush) {
                voronoiPaths.on("mousedown", function(d) {
                    var xy = d3.mouse( voronoiGroup.node() ),
                        xInv = xScale.invert(xy[0]);
                    brush.extent([xInv, xInv]);
                })
            }
        } else {
            callBrush();
        }
    };
    function makeUserAddedLines() {
        Object.keys(userAddedLines).forEach(function(lineKey, i) {
            chart.addLine( userAddedLines[lineKey] );
        });
    };

    // public api
    // nb: note that MOST setters return the chart to support method chaining

    // non-accessors first
    chart.margin = function(_) {
        if (!arguments.length) return margin;
        margin.top    = typeof _.top    !== "undefined" ? _.top    : margin.top;
        margin.right  = typeof _.right  !== "undefined" ? _.right  : margin.right;
        margin.bottom = typeof _.bottom !== "undefined" ? _.bottom : margin.bottom;
        margin.left   = typeof _.left   !== "undefined" ? _.left   : margin.left;
        return chart;
    };
    chart.width = function(_) {
        if (!arguments.length) return width;
        width = _;
        return chart;
    };
    chart.height = function(_) {
        if (!arguments.length) return height;
        height = _;
        return chart;
    };
    chart.radius = function(_) {
        if (!arguments.length) return radius;
        radius = _;
        return chart;
    };
    chart.lineInterpolator = function(_) {
        if (!arguments.length) return lineInterpolator;
        lineInterpolator = _;
        return chart;
    };
    chart.areaInterpolator = function(_) {
        if (!arguments.length) return areaInterpolator;
        areaInterpolator = _;
        return chart;
    };

    // listeners
    chart.onMouseMove = function(_) {
        if (!arguments.length) return onMouseMove;
        onMouseMove = _;
        return chart;
    };

    chart.onMouseOut = function(_) {
        if (!arguments.length) return onMouseOut;
        onMouseOut = _;
        return chart;
    };
    chart.onClick = function(_) {
        if (!arguments.length) return onClick;
        onClick = _;
        return chart;
    };
    chart.onBrushed = function(_) {
        if (!arguments.length) return onBrushed;
        onBrushed = function() { _(brush, brushG); }; // always pass brush and dom ref
        return chart;
    };
    chart.brush = function(_) {
        if (!arguments.length) return brush;
        brush = _;
        return chart;
    };
    // accessors
    chart.xAccessor = function(_) {
        if (!arguments.length) return xAccessor;
        xAccessor = _;
        return chart;
    };
    chart.yAccessor = function(_) {
        if (!arguments.length) return yAccessor;
        yAccessor = _;
        return chart;
    };
    chart.y2Accessor = function(_) {
        if (!arguments.length) return y2Accessor;
        y2Accessor = _;
        return chart;
    };
    chart.yConfidenceAccessor = function(_) {
        if (!arguments.length) return yConfidenceAccessor;
        yConfidenceAccessor = _;
        return chart;
    };

    chart.colorAccessor = function(_) {
        if (!arguments.length) return colorAccessor;
        colorAccessor = _;
        return chart;
    };
    chart.fillAccessor = function(_) {
        if (!arguments.length) return fillAccessor;
        fillAccessor = _;
        return chart;
    };
    chart.dashTypeAccessor = function(_) {
        if (!arguments.length) return dashTypeAccessor;
        dashTypeAccessor = _;
        return chart;
    };
    chart.radiusAccessor = function(_) {
        if (!arguments.length) return radiusAccessor;
        radiusAccessor = _;
        return chart;
    };

    // additional layers
    chart.tooltip = function(_) {
        if (!arguments.length) return tooltip;
        tooltip.class  = typeof _.class  !== "undefined" ? _.class : axisX.class;
        tooltip.div    = typeof _.div    !== "undefined" ? _.div   : axisX.div;
        return chart;
    };

    // axes-related
    chart.xAxis = function(_) {
        if (!arguments.length) return xAxis;
        xAxis = _;
        return chart;
    };
    chart.xScale = function(_) {
        if (!arguments.length) return xScale;
        xScale = _;
        return chart;
    };
    chart.axisX = function(_) { // this should be passed an object
        if (!arguments.length) return axisX;
        axisX.axisClass  = typeof _.axisClass  !== "undefined" ? _.axisClass : axisX.axisClass;
        axisX.titleClass = typeof _.titleClass !== "undefined" ? _.titleClass : axisX.titleClass;
        axisX.x          = typeof _.x          !== "undefined" ? _.x  : axisX.x;
        axisX.y          = typeof _.y          !== "undefined" ? _.y  : axisX.y;
        axisX.dy         = typeof _.dy         !== "undefined" ? _.dy : axisX.dy;
        axisX.textAnchor = typeof _.textAnchor !== "undefined" ? _.textAnchor : axisX.textAnchor;
        axisX.title      = typeof _.title      !== "undefined" ? _.title : axisX.title;
        axisX.nice       = typeof _.nice       !== "undefined" ? _.nice  : axisX.nice;
        axisX.limits     = typeof _.limits     !== "undefined" ? _.limits : axisX.limits;
        axisX.formatter  = typeof _.formatter  !== "undefined" ? _.formatter : axisX.formatter;
        return chart;
    };

    chart.yAxis = function(_) {
        if (!arguments.length) return yAxis;
        yAxis = _;
        return chart;
    };
    chart.yScale = function(_) {
        if (!arguments.length) return yScale;
        yScale = _;
        return chart;
    };
    chart.axisY = function(_) { // this should be passed an object
        if (!arguments.length) return axisY;
        axisY.axisClass  = typeof _.axisClass  !== "undefined" ? _.axisClass  : axisY.axisClass;
        axisY.titleClass = typeof _.titleClass !== "undefined" ? _.titleClass : axisY.titleClass;
        axisY.x          = typeof _.x          !== "undefined" ? _.x  : axisY.x;
        axisY.y          = typeof _.y          !== "undefined" ? _.y  : axisY.y;
        axisY.dy         = typeof _.dy         !== "undefined" ? _.dy : axisY.dy;
        axisY.textAnchor = typeof _.textAnchor !== "undefined" ? _.textAnchor : axisY.textAnchor;
        axisY.title      = typeof _.title      !== "undefined" ? _.title : axisY.title;
        axisY.limits     = typeof _.limits     !== "undefined" ? _.limits : axisY.limits;
        return chart;
    };

    chart.y2Axis = function(_) {
        if (!arguments.length) return y2Axis;
        y2Axis = _;
        return chart;
    };
    chart.axisY2 = function(_) { // this should be passed an object
        if (!arguments.length) return axisY2;
        axisY2.axisClass  = typeof _.axisClass  !== "undefined" ? _.axisClass  : axisY2.axisClass;
        axisY2.titleClass = typeof _.titleClass !== "undefined" ? _.titleClass : axisY2.titleClass;
        axisY2.x          = typeof _.x          !== "undefined" ? _.x  : axisY2.x;
        axisY2.y          = typeof _.y          !== "undefined" ? _.y  : axisY2.y;
        axisY2.dy         = typeof _.dy         !== "undefined" ? _.dy : axisY2.dy;
        axisY2.textAnchor = typeof _.textAnchor !== "undefined" ? _.textAnchor : axisY2.textAnchor;
        axisY2.title      = typeof _.title      !== "undefined" ? _.title : axisY2.title;
        axisY2.limits     = typeof _.limits     !== "undefined" ? _.limits : axisY2.limits;
        return chart;
    };

    // generators
    chart.lineGen = function(_) {
        if (!arguments.length) return lineGen;
        lineGen = _;
        return chart;
    };
    chart.areaGen = function(_) {
        if (!arguments.length) return areaGen;
        areaGen = _;
        return chart;
    };

    chart.updateChart = function(data) {
        callAxes(data);
        makeUserAddedLines();
        makeGroups(data);
        makeMouseEventLayer(data);
    };

    /*
     * { coords: [[x0, y0], [x1, y1]], stokeWidth, class,
     *  label: { x0:, x1, y0, y1, label, textAnchor } }
     */
    chart.addLine = function(lineObj) {
        if (!initialized) {
            userAddedLines[lineObj.name] = lineObj;
            return;
        }
        var container = lineObj.clipped ? this.clipped : this.svg;

        if (userAddedLines[lineObj.name] && userAddedLines[lineObj.name].remove) {
            userAddedLines[lineObj.name].remove();
        }

        if (container && lineObj.coords && lineObj.coords.length === 2) {
            lineObj.lineGroup = userAddedLines[lineObj.name] = container.append("g")
                .attr("class", (lineObj.class ? lineObj.class + " " : "") + classes.userAddedLines);

            lineObj.lineGroup.append("path")
                .style("stroke-width", lineObj.strokeWidth || "1px")
                .attr("stroke", colorAccessor(lineObj))
                .attr("d", userAddedLineGen(lineObj.coords));

            if (lineObj.point !== false) {
                lineObj.coords.forEach(function(xy, i) {
                    if ([undefined, true, ("x" + i)].indexOf(lineObj.point) !== -1) {
                         lineObj.lineGroup.append("circle")
                            .attr("class", classes.point)
                            .attr("r",     radiusAccessor(lineObj))
                            .attr("cx",    xScale( xy[0] ))
                            .attr("cy",    yScale( xy[1] ))
                            .style("fill", fillAccessor(lineObj));
                    }
                });
            }
            if (lineObj.label) { // @TODO untested
                lineObj.lineGroup.append("text")
                    .attr("x",  lineObj.label.x)
                    .attr("y",  lineObj.label.y)
                    .attr("dx", lineObj.label.dx || 0)
                    .attr("dy", lineObj.label.dy || 0)
                    .style("text-anchor", lineObj.label.textAnchor || "middle")
                    .html(lineObj.label.label);
            }
        }

        return lineObj
    };

    return chart;
}

// Helper functions

var getYDomain = function(data, yAccessor, yConfidenceAccessor, axisYObj, axis) {
    var getMax = function(d) { return yAccessor(d) + (yConfidenceAccessor ? yConfidenceAccessor(d) : 0); };
    var getMin = function(d) { return yAccessor(d) - (yConfidenceAccessor ? yConfidenceAccessor(d) : 0); };

    var min = axisYObj.limits.min !== undefined ? axisYObj.limits.min :
              d3.min(data, function(group) {
                  return group.visible !== false && (typeof group.axis === "undefined" || group.axis === axis) ?
                         d3.min(group.values, getMin) : Infinity;
              });

    var max = axisYObj.limits.max !== undefined ? axisYObj.limits.max :
              d3.max(data, function(group) {
                  return group.visible !== false && (typeof group.axis === "undefined" || group.axis === axis) ?
                         d3.max(group.values, getMax) : -Infinity;
              });

    if (axisYObj.limits.min === undefined && min > 0) {
        min = 0; // misleading if not set to zero
    }
    if (axisYObj.limits.symmetric) {
        max = (Math.abs(max) > Math.abs(min) && min !== max) ? max : Math.abs(min);
        min = (Math.abs(max) > Math.abs(min) && min !== max) ? -max : min;
    }

    return [min, max];
};

// returns { points: d3sele, line: d3sele, area: d3sele}
// nb: returned d3 selections may be empty!
var getGroupElems = function(datum) {
    return !datum ? null : {
        area:   datum.g.select("path." + classes.area),
        line:   datum.g.select("path." + classes.line),
        points: datum.g.selectAll("circle")
    };
}
var getDataForName = function(data, name) {
    for (var i = 0; i < data.length; i++) {
        if (data[i].name === name) {
            return  data[i];
        }
    }
    return null;
};
var getGroup = function(data, name, elemsOnly) { // wrapper for getGroupElems / getDataForName
    return elemsOnly ? getGroupElems( getDataForName(data, name) ) :
                       getDataForName(data, name);
};
