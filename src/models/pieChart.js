nv.models.pieChart = function() {
    "use strict";

    //============================================================
    // Public Variables with Default Settings
    //------------------------------------------------------------

    var pie = nv.models.pie();
    var legend = nv.models.legend();

    var margin = {top: 30, right: 20, bottom: 20, left: 20}
        , width = null
        , height = null
        , showLegend = true
        , color = nv.utils.defaultColor()
        , tooltips = true
        , tooltip = function(key, y, e, graph) {
            return '<h3 style="background-color: '
                + e.color + '">' + key + '</h3>'
                + '<p>' +  y + '</p>';
        }
        , state = nv.utils.state()
        , defaultState = null
        , noData = "No Data Available."
        , duration = 250
        , dispatch = d3.dispatch('tooltipShow', 'tooltipHide', 'stateChange', 'changeState','renderEnd')
        ;

    //============================================================
    // Private Variables
    //------------------------------------------------------------

    var showTooltip = function(e, offsetElement) {
        var tooltipLabel = pie.x()(e.point);
        var left = e.pos[0] + ( (offsetElement && offsetElement.offsetLeft) || 0 ),
            top = e.pos[1] + ( (offsetElement && offsetElement.offsetTop) || 0),
            y = pie.valueFormat()(pie.y()(e.point)),
            content = tooltip(tooltipLabel, y, e, chart)
            ;
        // This is a hack for IE10, where the tooltip would flash and disappear because the tooltip pop up
        // appears right under the mouse point, triggering a mouseout event that destroys the pop up
        // immediately after the pop up shows. Once the pop up is destroyed, the mouseover event fires again
        // and we're at the beginning of this cycle again. To fix it we just shift the pop up a little north
        // so it does not appear under the mouse pointer.
        top = top - 50;

        nv.tooltip.show([left, top], content, e.value < 0 ? 'n' : 's', null, offsetElement);
    };

    var renderWatch = nv.utils.renderWatch(dispatch);

    var stateGetter = function(data) {
        return function(){
            return {
                active: data.map(function(d) { return !d.disabled })
            };
        }
    };

    var stateSetter = function(data) {
        return function(state) {
            if (state.active !== undefined) {
                data.forEach(function (series, i) {
                    series.disabled = !state.active[i];
                });
            }
        }
    };

    //============================================================
    // Chart function
    //------------------------------------------------------------

    function chart(selection) {
        renderWatch.reset();
        renderWatch.models(pie);

        selection.each(function(data) {
            var container = d3.select(this);
            nv.utils.initSVG(container);

            var that = this;
            var availableWidth = (width || parseInt(container.style('width'), 10) || 960)
                    - margin.left - margin.right,
                availableHeight = (height || parseInt(container.style('height'), 10) || 400)
                    - margin.top - margin.bottom
                ;

            chart.update = function() { container.transition().call(chart); };
            chart.container = this;

            state.setter(stateSetter(data), chart.update)
                .getter(stateGetter(data))
                .update();

            //set state.disabled
            state.disabled = data.map(function(d) { return !!d.disabled });

            if (!defaultState) {
                var key;
                defaultState = {};
                for (key in state) {
                    if (state[key] instanceof Array)
                        defaultState[key] = state[key].slice(0);
                    else
                        defaultState[key] = state[key];
                }
            }

            // Display No Data message if there's nothing to show.
            if (!data || !data.length) {
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

            // Setup containers and skeleton of chart
            var wrap = container.selectAll('g.nv-wrap.nv-pieChart').data([data]);
            var gEnter = wrap.enter().append('g').attr('class', 'nvd3 nv-wrap nv-pieChart').append('g');
            var g = wrap.select('g');

            gEnter.append('g').attr('class', 'nv-pieWrap');
            gEnter.append('g').attr('class', 'nv-legendWrap');

            // Legend
            if (showLegend) {
                legend.width( availableWidth ).key(pie.x());
                legend.alignPos("centre");

                wrap.select('.nv-legendWrap')
                    .datum(data)
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
                availableHeight = (height || parseInt(container.style('height')) || 400)  // In case top/bottom margin has changed.
                    - margin.top - margin.bottom;

                var legY;
                if (showLegend === "bottom") {
                    // New feature, legend to appear at bottom.
                    legY = availableHeight + (margin.bottom - legend.height());
                } else {
                    // Original feature, legend appears at top.
                    legY = -margin.top;
                }
                wrap.select('.nv-legendWrap')
                    .attr('transform', 'translate(0,' + legY +')');
            }
            wrap.attr('transform', 'translate(' + margin.left + ',' + margin.top + ')');

            // Main Chart Component(s)
            pie.width(availableWidth).height(availableHeight);
            var pieWrap = g.select('.nv-pieWrap').datum([data]);
            d3.transition(pieWrap).call(pie);

            // Event Handling/Dispatching (in chart's scope)
            legend.dispatch.on('stateChange', function(newState) {
                for (var key in newState) {
                    state[key] = newState[key];
                }
                dispatch.stateChange(state);
                chart.update();
            });

            pie.dispatch.on('elementMouseout.tooltip', function(e) {
                dispatch.tooltipHide(e);
            });

            // Update chart from a state object passed to event handler
            dispatch.on('changeState', function(e) {
                if (typeof e.disabled !== 'undefined') {
                    data.forEach(function(series,i) {
                        series.disabled = e.disabled[i];
                    });
                    state.disabled = e.disabled;
                }
                chart.update();
            });

        });

        renderWatch.renderEnd('pieChart immediate');
        return chart;
    }

    //============================================================
    // Event Handling/Dispatching (out of chart's scope)
    //------------------------------------------------------------

    pie.dispatch.on('elementMouseover.tooltip', function(e) {
        e.pos = [e.pos[0] +  margin.left, e.pos[1] + margin.top];
        dispatch.tooltipShow(e);
    });

    dispatch.on('tooltipShow', function(e) {
        if (tooltips) showTooltip(e);
    });

    dispatch.on('tooltipHide', function() {
        if (tooltips) nv.tooltip.cleanup();
    });

    //============================================================
    // Expose Public Variables
    //------------------------------------------------------------

    // expose chart's sub-components
    chart.legend = legend;
    chart.dispatch = dispatch;
    chart.pie = pie;
    chart.options = nv.utils.optionsFunc.bind(chart);

    // use Object get/set functionality to map between vars and chart functions
    chart._options = Object.create({}, {
        // simple options, just get/set the necessary values
        noData:         {get: function(){return noData;},         set: function(_){noData=_;}},
        tooltipContent: {get: function(){return tooltip;},        set: function(_){tooltip=_;}},
        tooltips:       {get: function(){return tooltips;},       set: function(_){tooltips=_;}},
        showLegend:     {get: function(){return showLegend;},     set: function(_){showLegend=_;}},
        defaultState:   {get: function(){return defaultState;},   set: function(_){defaultState=_;}},
        // options that require extra logic in the setter
        color: {get: function(){return color;}, set: function(_){
            color = _;
            legend.color(color);
            pie.color(color);
        }},
        duration: {get: function(){return duration;}, set: function(_){
            duration = _;
            renderWatch.reset(duration);
        }}
    });
    nv.utils.inheritOptions(chart, pie);
    nv.utils.initOptions(chart);
    return chart;
};
