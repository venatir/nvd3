nv.models.multiChart = function() {
    "use strict";

    //============================================================
    // Public Variables with Default Settings
    //------------------------------------------------------------

    var margin = {top: 30, right: 20, bottom: 50, left: 60}
        , color = nv.utils.defaultColor()
        , width = null
        , height = null
        , showLegend = true
        , tooltips = true
        , tooltip = function(key, x, y, e, graph) {
            return '<h3>' + key + '</h3>' +
                '<p>' +  y + ' at ' + x + '</p>'
        }
        , x
        , y
        , noData = 'No Data Available.'
        , yDomain1
        , yDomain2
        , getX = function(d) { return d.x }
        , getY = function(d) { return d.y}
        , interpolate = 'monotone'
        ;

    //============================================================
    // Private Variables
    //------------------------------------------------------------

    var x = d3.scale.linear(),
        yScale1 = d3.scale.linear(),
        yScale2 = d3.scale.linear(),

        lines1 = nv.models.line().yScale(yScale1),
        lines2 = nv.models.line().yScale(yScale2),

        bars1 = nv.models.multiBar().stacked(false).hideable(true).yScale(yScale1),
        bars2 = nv.models.multiBar().stacked(false).hideable(true).yScale(yScale2),

        stack1 = nv.models.stackedArea().yScale(yScale1),
        stack2 = nv.models.stackedArea().yScale(yScale2),

        xAxis = nv.models.axis().scale(x).orient('bottom').tickPadding(5),
        yAxis1 = nv.models.axis().scale(yScale1).orient('left'),
        yAxis2 = nv.models.axis().scale(yScale2).orient('right'),

        legend = nv.models.legend().height(30),
        dispatch = d3.dispatch('tooltipShow', 'tooltipHide');

    // Because we use padData to adjust lines' outer padding so the data points line
    // up with the middle of the bars, we have to turn off voronoi because the use
    // of padData seem to cause conflict with the voronoi calculations in d3.js.
    lines1.scatter.useVoronoi(false);
    lines2.scatter.useVoronoi(false);

    var showTooltip = function(e, offsetElement) {
        var left = e.pos[0] + ( offsetElement.offsetLeft || 0 ),
            top = e.pos[1] + ( offsetElement.offsetTop || 0),
            x = xAxis.tickFormat()(lines1.x()(e.point, e.pointIndex)),
            y = ((e.series.yAxis == 2) ? yAxis2 : yAxis1).tickFormat()(lines1.y()(e.point, e.pointIndex)),
            content = tooltip(e.series.key, x, y, e, chart);

        nv.tooltip.show([left, top], content, undefined, undefined, offsetElement.offsetParent);
    };

    function chart(selection) {
        selection.each(function(data) {
            var container = d3.select(this),
                that = this;
            nv.utils.initSVG(container);

            chart.update = function() { container.transition().call(chart); };
            chart.container = this;

            var availableWidth = (width  || parseInt(container.style('width')) || 960)
                    - margin.left - margin.right,
                availableHeight = (height || parseInt(container.style('height')) || 400)
                    - margin.top - margin.bottom;

            var dataLines1 = data.filter(function(d) {return d.type == 'line' && d.yAxis == 1});
            var dataLines2 = data.filter(function(d) {return d.type == 'line' && d.yAxis == 2});
            var dataBars1 =  data.filter(function(d) {return d.type == 'bar'  && d.yAxis == 1});
            var dataBars2 =  data.filter(function(d) {return d.type == 'bar'  && d.yAxis == 2});
            var dataStack1 = data.filter(function(d) {return d.type == 'area' && d.yAxis == 1});
            var dataStack2 = data.filter(function(d) {return d.type == 'area' && d.yAxis == 2});

            // Display noData message if there's nothing to show.
            if (!data || !data.length || !data.filter(function(d) { return d.values.length }).length) {
                var noDataText = container.selectAll('.nv-noData').data([noData]);

                noDataText.enter().append('text')
                    .attr('class', 'nvd3 nv-noData')
                    .attr('dy', '-.7em')
                    .style('text-anchor', 'middle');

                noDataText
                    .attr('x', margin.left + availableWidth / 2)
                    .attr('y', margin.top + availableHeight / 2)
                    .text(function(d) { return d });

                return chart;
            } else {
                container.selectAll('.nv-noData').remove();
            }

            var series1 = filterSeriesValues(data, 1);
            var series2 = filterSeriesValues(data, 2);

            x   .domain(d3.extent(d3.merge(series1.concat(series2)), function(d) { return d.x } ))
                .range([0, availableWidth]);

            var wrap = container.selectAll('g.wrap.multiChart').data([data]);
            var gEnter = wrap.enter().append('g').attr('class', 'wrap nvd3 multiChart').append('g');

            // The order is significant, we want lines to be drawn on top of the bars to look better.
            gEnter.append('g').attr('class', 'nv-x nv-axis');
            gEnter.append('g').attr('class', 'nv-y1 nv-axis');
            gEnter.append('g').attr('class', 'nv-y2 nv-axis');
            gEnter.append('g').attr('class', 'bars1Wrap');
            gEnter.append('g').attr('class', 'bars2Wrap');
            gEnter.append('g').attr('class', 'lines1Wrap');
            gEnter.append('g').attr('class', 'lines2Wrap');
            gEnter.append('g').attr('class', 'stack1Wrap');
            gEnter.append('g').attr('class', 'stack2Wrap');
            gEnter.append('g').attr('class', 'legendWrap');

            var g = wrap.select('g');

            var color_array = data.map(function(d,i) {
                return data[i].color || color(d, i);
            });

            if (showLegend) {
                legend.color(color_array);
                
                if (showLegend === "bottom") {
                    // New feature, legend will appear centred at bottom.
                    legend.width(availableWidth);
                    legend.alignPos("centre");
                } else {
                    legend.width( availableWidth / 2 );
                }

                g.select('.legendWrap')
                    .datum(data.map(function(series) {
                        series.originalKey = series.originalKey === undefined ? series.key : series.originalKey;
                        series.key = series.originalKey + (series.yAxis == 1 ? '' : ' (right axis)');
                        return series;
                    }))
                    .call(legend);

                // Adjust top/bottom margin to match legend height in case legend spans multiple lines.
                if (showLegend === "bottom") {
                    // Original margin is saved and added to legend height.
                    if (typeof margin.original_bottom === "undefined") {
                        margin.original_bottom = margin.bottom;
                    }
                    margin.bottom = legend.height() + margin.original_bottom;
                } else if (showLegend !== "bottom" && margin.top != legend.height()) {
                    margin.top = legend.height();
                }
                availableHeight = (height || parseInt(container.style('height')) || 400) // In case top/bottom margin has changed.
                    - margin.top - margin.bottom;

                var legX, legY;
                if (showLegend === "bottom") {
                    // New feature, legend to appear at bottom.
                    legX = 0;
                    legY = availableHeight + (margin.bottom - legend.height());
                } else {
                    // Original feature, legend appears at top.
                    legX = availableWidth / 2;
                    legY = -margin.top;
                }
                g.select('.legendWrap')
                    .attr('transform', 'translate(' + legX + ',' + legY +')');
            }

            lines1
                .width(availableWidth)
                .height(availableHeight)
                .interpolate(interpolate)
                .color(color_array.filter(function(d,i) { return !data[i].disabled && data[i].yAxis == 1 && data[i].type == 'line'}));
            lines2
                .width(availableWidth)
                .height(availableHeight)
                .interpolate(interpolate)
                .color(color_array.filter(function(d,i) { return !data[i].disabled && data[i].yAxis == 2 && data[i].type == 'line'}));
            bars1
                .width(availableWidth)
                .height(availableHeight)
                .color(color_array.filter(function(d,i) { return !data[i].disabled && data[i].yAxis == 1 && data[i].type == 'bar'}));
            bars2
                .width(availableWidth)
                .height(availableHeight)
                .color(color_array.filter(function(d,i) { return !data[i].disabled && data[i].yAxis == 2 && data[i].type == 'bar'}));
            stack1
                .width(availableWidth)
                .height(availableHeight)
                .color(color_array.filter(function(d,i) { return !data[i].disabled && data[i].yAxis == 1 && data[i].type == 'area'}));
            stack2
                .width(availableWidth)
                .height(availableHeight)
                .color(color_array.filter(function(d,i) { return !data[i].disabled && data[i].yAxis == 2 && data[i].type == 'area'}));

            g.attr('transform', 'translate(' + margin.left + ',' + margin.top + ')');

            var lines1Wrap = g.select('.lines1Wrap')
                .datum(
                    dataLines1.filter(function(d){return !d.disabled})
                );
            var bars1Wrap = g.select('.bars1Wrap')
                .datum(
                    dataBars1.filter(function(d){return !d.disabled})
                );
            var stack1Wrap = g.select('.stack1Wrap')
                .datum(
                    dataStack1.filter(function(d){return !d.disabled})
                );

            var lines2Wrap = g.select('.lines2Wrap')
                .datum(
                    dataLines2.filter(function(d){return !d.disabled})
                );
            var bars2Wrap = g.select('.bars2Wrap')
                .datum(
                    dataBars2.filter(function(d){return !d.disabled})
                );
            var stack2Wrap = g.select('.stack2Wrap')
                .datum(
                    dataStack2.filter(function(d){return !d.disabled})
                );

            // extraValue1 and extraValue2 are used to work out the domain of the y-axis scales (yScale1 and yScale2).
            // We cannot just use the individual series values because the largest domain value is obtained
            // from summing the series together (stacking them).
            var extraValue1 = reduceStackedSeries(dataStack1);
            if (bars1.stacked()) {
                // Also include stacked bar series in extraValue.
                extraValue1 = reduceStackedSeries(dataBars1).concat(extraValue1);
            }
                
            var extraValue2 = reduceStackedSeries(dataStack2);
            if (bars2.stacked()) {
                // Also include stacked bar series in extraValue.
                extraValue2 = reduceStackedSeries(dataBars2).concat(extraValue2);
            }

            yScale1 .domain(yDomain1 || d3.extent(d3.merge(series1).concat(extraValue1), function(d) { return d.y } ))
                .range([0, availableHeight])

            yScale2 .domain(yDomain2 || d3.extent(d3.merge(series2).concat(extraValue2), function(d) { return d.y } ))
                .range([0, availableHeight])

            lines1.yDomain(yScale1.domain())
            bars1.yDomain(yScale1.domain())
            stack1.yDomain(yScale1.domain())

            lines2.yDomain(yScale2.domain())
            bars2.yDomain(yScale2.domain())
            stack2.yDomain(yScale2.domain())

            if(dataStack1.length){d3.transition(stack1Wrap).call(stack1);}
            if(dataStack2.length){d3.transition(stack2Wrap).call(stack2);}

            // This is the outer padding to offset lines and x-axis to line up data points with bars.
            // When setting this variable, we're assuming all bars will be on bars1 or bars2, but not both.
            var rbcOffset = 0;

            if (dataBars1.length) {
                d3.transition(bars1Wrap).call(bars1);
                // Leave rbcOffset as 0 if all series in dataBars are disabled, because the
                // rangeBandCentreOffset value is invalid if all series are disabled.
                if (! dataBars1.every(function (series) { return series.disabled; })) {
                    rbcOffset = bars1.rangeBandCentreOffset();
                }
            }
            if (dataBars2.length) {
                d3.transition(bars2Wrap).call(bars2);
                // Leave rbcOffset as 0 if all series in dataBars are disabled, because the
                // rangeBandCentreOffset value is invalid if all series are disabled.
                if (! dataBars2.every(function (series) { return series.disabled; })) {
                    rbcOffset = bars2.rangeBandCentreOffset();
                }
            }

            if (dataLines1.length) {
                lines1.scatter.padData(rbcOffset > 0);
                d3.transition(lines1Wrap).call(lines1);
            }
            if (dataLines2.length) {
                lines2.scatter.padData(rbcOffset > 0);
                d3.transition(lines2Wrap).call(lines2);
            }

            xAxis
                .ticks( nv.utils.calcTicksX(availableWidth/100, data) )
                .tickSize(-availableHeight, 0);

            // We also want to add outer padding to x-axis so that axis ticks and labels align with
            // data points at centre of bars. We do this by translating x-axis by rbcOffset, and
            // reducing the width of the entire axis (via a scale transformation).
            g.select('.nv-x.nv-axis')
                .attr('transform',
                      'translate(' + rbcOffset + ', ' + availableHeight + ') ' +
                      'scale(' + ((availableWidth - rbcOffset*2)/availableWidth) + ', 1)');

            d3.transition(g.select('.nv-x.nv-axis'))
                .call(xAxis);

            yAxis1
                .ticks( nv.utils.calcTicksY(availableHeight/36, data) )
                .tickSize( -availableWidth, 0);


            d3.transition(g.select('.nv-y1.nv-axis'))
                .call(yAxis1);

            yAxis2
                .ticks( nv.utils.calcTicksY(availableHeight/36, data) )
                .tickSize( -availableWidth, 0);

            d3.transition(g.select('.nv-y2.nv-axis'))
                .call(yAxis2);

            g.select('.nv-y1.nv-axis')
                .classed('nv-disabled', series1.length ? false : true)
                .attr('transform', 'translate(' + x.range()[0] + ',0)');

            g.select('.nv-y2.nv-axis')
                .classed('nv-disabled', series2.length ? false : true)
                .attr('transform', 'translate(' + x.range()[1] + ',0)');

            legend.dispatch.on('stateChange', function(newState) {
                chart.update();
            });

            dispatch.on('tooltipShow', function(e) {
                if (tooltips) showTooltip(e, that.parentNode);
            });

        });

        return chart;
    }
    
    // yAxisNumber - 1: keep series on left y-axis only,
    //             - 2: keep series on right y-axis only.
    // barsOnly - true: keep bar series on correct y-axis only,
    //          - false: keep all types of series on correct y-axis.
    function filterSeriesValues(data, yAxisNumber, barsOnly) {
        // Only enabled series on the correct yAxis remains.
        var series = data.filter(function (d) {
            if (barsOnly && d.type !== 'bar') {
                return false;
            }
            return !d.disabled && d.yAxis == yAxisNumber;
        });
        // Extract {x,y} data points from series.
        var dataPoints = series.map(function (d) {
            // 'd' is a series object, extract its values.
            return d.values.map(function (d, i) {
                return { x: d.x, y: d.y };
            });
        });
        return dataPoints;
    }

    function reduceStackedSeries(data) {
        if (data.length) {
            var arrOfArr = data.map(function (a) {
                // 'a' is a series object, and a.values is an array of {x,y} data points.
                return a.values;
            });
            var arr = arrOfArr.reduce(function (a, b) {
                // 'a' is the first array of data points, 'b' is the second array of data points.
                // This function is called only if there is 2 or more elements in arrOfArr.
                // The map below computes a[i].y + b[i].y assuming 'a' and 'b' have the same
                // number of elements (i.e. data points).
                return a.map(function (aVal, i) {
                    return {
                        x: aVal.x,
                        y: aVal.y + b[i].y
                    };
                });
            });
            // At this point, arr is an array of summed (stacked) data points. Because we are showing
            // a stacked chart, always start the y-axis at (0,0). (I guess it looks more natural.)
            return arr.concat( [ {x:0, y:0} ] );
        } else {
            return [];
        }
    }

    //============================================================
    // Event Handling/Dispatching (out of chart's scope)
    //------------------------------------------------------------

    lines1.dispatch.on('elementMouseover.tooltip', function(e) {
        e.pos = [e.pos[0] +  margin.left, e.pos[1] + margin.top];
        dispatch.tooltipShow(e);
    });

    lines1.dispatch.on('elementMouseout.tooltip', function(e) {
        dispatch.tooltipHide(e);
    });

    lines2.dispatch.on('elementMouseover.tooltip', function(e) {
        e.pos = [e.pos[0] +  margin.left, e.pos[1] + margin.top];
        dispatch.tooltipShow(e);
    });

    lines2.dispatch.on('elementMouseout.tooltip', function(e) {
        dispatch.tooltipHide(e);
    });

    bars1.dispatch.on('elementMouseover.tooltip', function(e) {
        e.pos = [e.pos[0] +  margin.left, e.pos[1] + margin.top];
        dispatch.tooltipShow(e);
    });

    bars1.dispatch.on('elementMouseout.tooltip', function(e) {
        dispatch.tooltipHide(e);
    });

    bars2.dispatch.on('elementMouseover.tooltip', function(e) {
        e.pos = [e.pos[0] +  margin.left, e.pos[1] + margin.top];
        dispatch.tooltipShow(e);
    });

    bars2.dispatch.on('elementMouseout.tooltip', function(e) {
        dispatch.tooltipHide(e);
    });

    stack1.dispatch.on('tooltipShow', function(e) {
        //disable tooltips when value ~= 0
        //// TODO: consider removing points from voronoi that have 0 value instead of this hack
        if (!Math.round(stack1.y()(e.point) * 100)) {  // 100 will not be good for very small numbers... will have to think about making this valu dynamic, based on data range
            setTimeout(function() { d3.selectAll('.point.hover').classed('hover', false) }, 0);
            return false;
        }

        e.pos = [e.pos[0] + margin.left, e.pos[1] + margin.top],
            dispatch.tooltipShow(e);
    });

    stack1.dispatch.on('tooltipHide', function(e) {
        dispatch.tooltipHide(e);
    });

    stack2.dispatch.on('tooltipShow', function(e) {
        //disable tooltips when value ~= 0
        //// TODO: consider removing points from voronoi that have 0 value instead of this hack
        if (!Math.round(stack2.y()(e.point) * 100)) {  // 100 will not be good for very small numbers... will have to think about making this valu dynamic, based on data range
            setTimeout(function() { d3.selectAll('.point.hover').classed('hover', false) }, 0);
            return false;
        }

        e.pos = [e.pos[0] + margin.left, e.pos[1] + margin.top],
            dispatch.tooltipShow(e);
    });

    stack2.dispatch.on('tooltipHide', function(e) {
        dispatch.tooltipHide(e);
    });

    lines1.dispatch.on('elementMouseover.tooltip', function(e) {
        e.pos = [e.pos[0] +  margin.left, e.pos[1] + margin.top];
        dispatch.tooltipShow(e);
    });

    lines1.dispatch.on('elementMouseout.tooltip', function(e) {
        dispatch.tooltipHide(e);
    });

    lines2.dispatch.on('elementMouseover.tooltip', function(e) {
        e.pos = [e.pos[0] +  margin.left, e.pos[1] + margin.top];
        dispatch.tooltipShow(e);
    });

    lines2.dispatch.on('elementMouseout.tooltip', function(e) {
        dispatch.tooltipHide(e);
    });

    dispatch.on('tooltipHide', function() {
        if (tooltips) nv.tooltip.cleanup();
    });

    //============================================================
    // Global getters and setters
    //------------------------------------------------------------

    chart.dispatch = dispatch;
    chart.legend = legend;
    chart.lines1 = lines1;
    chart.lines2 = lines2;
    chart.bars1 = bars1;
    chart.bars2 = bars2;
    chart.stack1 = stack1;
    chart.stack2 = stack2;
    chart.xAxis = xAxis;
    chart.yAxis1 = yAxis1;
    chart.yAxis2 = yAxis2;

    chart.options = nv.utils.optionsFunc.bind(chart);

    chart._options = Object.create({}, {
        // simple options, just get/set the necessary values
        width:      {get: function(){return width;}, set: function(_){width=_;}},
        height:     {get: function(){return height;}, set: function(_){height=_;}},
        showLegend: {get: function(){return showLegend;}, set: function(_){showLegend=_;}},
        yDomain1:      {get: function(){return yDomain1;}, set: function(_){yDomain1=_;}},
        yDomain2:    {get: function(){return yDomain2;}, set: function(_){yDomain2=_;}},
        tooltips:    {get: function(){return tooltips;}, set: function(_){tooltips=_;}},
        tooltipContent:    {get: function(){return tooltip;}, set: function(_){tooltip=_;}},
        noData:    {get: function(){return noData;}, set: function(_){noData=_;}},
        interpolate:    {get: function(){return interpolate;}, set: function(_){interpolate=_;}},

        // options that require extra logic in the setter
        margin: {get: function(){return margin;}, set: function(_){
            margin.top    = _.top    !== undefined ? _.top    : margin.top;
            margin.right  = _.right  !== undefined ? _.right  : margin.right;
            margin.bottom = _.bottom !== undefined ? _.bottom : margin.bottom;
            margin.left   = _.left   !== undefined ? _.left   : margin.left;
        }},
        color:  {get: function(){return color;}, set: function(_){
            color = nv.utils.getColor(_);
        }},
        x: {get: function(){return getX;}, set: function(_){
            getX = _;
            lines1.x(_);
            bars1.x(_);
        }},
        y: {get: function(){return getY;}, set: function(_){
            getY = _;
            lines1.y(_);
            bars1.y(_);
        }},
        stacked: {
            get: function ()  { return bars1.stacked(); },
            set: function (_) { bars1.stacked(_); bars2.stacked(_); }
        }
    });

    nv.utils.initOptions(chart);

    return chart;
};

