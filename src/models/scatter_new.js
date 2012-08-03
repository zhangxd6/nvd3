
nv.models.scatter = function() {

  //============================================================
  // Public Variables with Default Settings
  //------------------------------------------------------------

  var margin       = {top: 0, right: 0, bottom: 0, left: 0}
   ,  width        = 960
   ,  height       = 500
   ,  color        = nv.utils.defaultColor() // chooses color
   ,  id           = Math.floor(Math.random() * 100000) //Create semi-unique ID incase user doesn't selet one
   ,  x            = d3.scale.linear()
   ,  y            = d3.scale.linear()
   ,  z            = d3.scale.linear() //linear because d3.svg.shape.size is treated as area
   ,  getSeries    = function(d) { return d } // accessor to get the array of series from the initial data structure provided
   ,  getSeriesKey = function(d) { return d.key } // accessor to get the series key
   ,  getPoints    = function(d) { return d.values } // accessor to get the array of pointd from the array of series
   ,  getX         = function(d) { return d.x } // accessor to get the x value
   ,  getY         = function(d) { return d.y } // accessor to get the y value
   ,  getSize      = function(d) { return d.size } // accessor to get the point size
   ,  getShape     = function(d) { return d.shape || 'circle' } // accessor to get point shape
   ,  forceX       = [] // List of numbers to Force into the X scale (ie. 0, or a max / min, etc.)
   ,  forceY       = [] // List of numbers to Force into the Y scale
   ,  forceSize    = [] // List of numbers to Force into the Size scale
   ,  interactive  = true // If true, plots a voronoi overlay for advanced point interection
   ,  pointActive  = function(d) { return !d.notActive } // any points that return false will be filtered out
   ,  clipEdge     = false // if true, masks points within x and y scale
   ,  clipVoronoi  = true // if true, masks each point with a circle... can turn off to slightly increase performance
   ,  clipRadius   = function() { return 25 } // function to get the radius for voronoi point clips
   ,  xDomain      = null // Override x domain (skips the calculation from data)
   ,  yDomain      = null // Override y domain
   ,  sizeDomain   = null // Override point size domain
   ,  singlePoint  = false
   ,  dispatch     = d3.dispatch('elementClick', 'elementMouseover', 'elementMouseout')
   ;

  //============================================================


  //============================================================
  // Private Variables
  //------------------------------------------------------------

  var timeoutID
    ;

  //============================================================


  function chart(selection) {
    selection.each(function(data) {
      var availableWidth = width - margin.left - margin.right,
          availableHeight = height - margin.top - margin.bottom,
          container = d3.select(this),
          x0, // old x-scale
          y0, // old y-scale
          z0; // old z-scale (size scale)

      //add series index to each data point for reference
      data = data.map(function(series, i) {
        getPoints(series,i).map(function(point) {
          point.series = i;
          return point;
        });
        return series;
      });



      //------------------------------------------------------------
      // Setup Scales

      // remap and flatten the data for use in calculating the scales' domains
      var seriesData = (xDomain && yDomain && sizeDomain) ? [] : // if we know xDomain and yDomain and sizeDomain, no need to calculate.... if Size is constant remember to set sizeDomain to speed up performance
            d3.merge(
              getSeries(data).map(function(d,j) {
                return getPoints(d,j).map(function(d,i) {
                  return { x: getX(d,i), y: getY(d,i), size: getSize(d,i) }
                })
              })
            );

      x   .domain(xDomain || d3.extent(seriesData.map(function(d) { return d.x }).concat(forceX)))
          .range([0, availableWidth]);

      y   .domain(yDomain || d3.extent(seriesData.map(function(d) { return d.y }).concat(forceY)))
          .range([availableHeight, 0]);

      z   .domain(sizeDomain || d3.extent(seriesData.map(function(d) { return d.size }).concat(forceSize)))
          .range([16, 256]);

      // If scale's domain don't have a range, slightly adjust to make one... so a chart can show a single data point
      if (x.domain()[0] === x.domain()[1] || y.domain()[0] === y.domain()[1]) singlePoint = true;
      if (x.domain()[0] === x.domain()[1])
        x.domain()[0] ?
            x.domain([x.domain()[0] - x.domain()[0] * 0.01, x.domain()[1] + x.domain()[1] * 0.01])
          : x.domain([-1,1]);

      if (y.domain()[0] === y.domain()[1])
        y.domain()[0] ?
            y.domain([y.domain()[0] + y.domain()[0] * 0.01, y.domain()[1] - y.domain()[1] * 0.01])
          : y.domain([-1,1]);


      // Retrieve the old scales, if this is an update.
      if (this.__chart__) {
        x0 = this.__chart__.x;
        y0 = this.__chart__.y;
        z0 = this.__chart__.z;
        //TODO: id should be per element in selection, not per whole chart... BUT maybe could just append this selection element's index to the id
      } else {
        x0 = x.copy();
        y0 = y.copy();
        z0 = z.copy();
      }

      //------------------------------------------------------------


      //------------------------------------------------------------
      // Setup containers and skeleton of chart

      var wrap = container.selectAll('g.nv-wrap.nv-scatter').data([data]);
      var wrapEnter = wrap.enter().append('g').attr('class', 'nvd3 nv-wrap nv-scatter nv-chart-' + id + (singlePoint ? ' nv-single-point' : ''));
      var defsEnter = wrapEnter.append('defs');
      var gEnter = wrapEnter.append('g');
      var g = wrap.select('g');

      gEnter.append('g').attr('class', 'nv-groups');
      gEnter.append('g').attr('class', 'nv-point-paths');

      wrap.attr('transform', 'translate(' + margin.left + ',' + margin.top + ')');

      //------------------------------------------------------------


      defsEnter.append('clipPath')
          .attr('id', 'nv-edge-clip-' + id)
        .append('rect');

      wrap.select('#nv-edge-clip-' + id + ' rect')
          .attr('width', availableWidth)
          .attr('height', availableHeight);

      g   .attr('clip-path', clipEdge ? 'url(#nv-edge-clip-' + id + ')' : '');



      function updateInteractiveLayer() {

        if (!interactive) return false;


        var vertices = d3.merge(getSeries(data).map(function(group, groupIndex) {
            return getPoints(group, groupIndex)
              .filter(pointActive) // remove non-interactive points
              .map(function(point, pointIndex) {
                // *Adding noise to make duplicates very unlikely
                // **Injecting series and point index for reference
                return [x(getX(point,pointIndex)) * (Math.random() / 1e12 + 1)  , y(getY(point,pointIndex)) * (Math.random() / 1e12 + 1), groupIndex, pointIndex]; //temp hack to add noise untill I think of a better way so there are no duplicates
              })
          })
        );


        if (clipVoronoi) {
          defsEnter.append('clipPath').attr('id', 'nv-points-clip-' + id);

          var pointClips = wrap.select('#nv-points-clip-' + id).selectAll('circle')
              .data(vertices);
          pointClips.enter().append('circle')
              .attr('r', clipRadius);
          pointClips.exit().remove();
          pointClips
              .attr('cx', function(d) { return d[0] })
              .attr('cy', function(d) { return d[1] });

          wrap.select('.nv-point-paths')
              .attr('clip-path', 'url(#nv-points-clip-' + id + ')');
        }


        //inject series and point index for reference into voronoi
        var voronoi = d3.geom.voronoi(vertices).map(function(d, i) {
            return {
              'data': d,
              'series': vertices[i][2],
              'point': vertices[i][3]
            }
          });


        var pointPaths = wrap.select('.nv-point-paths').selectAll('path')
            .data(voronoi);
        pointPaths.enter().append('path')
            .attr('class', function(d,i) { return 'nv-path-'+i; });
        pointPaths.exit().remove();
        pointPaths
            .attr('d', function(d) { return 'M' + d.data.join(',') + 'Z'; })
            .on('click', function(d) {
              var series = getSeries(data)[d.series],
                  point  = getPoints(series, d.series)[d.point];

              dispatch.elementClick({
                point: point,
                series: series,
                pos: [x(getX(point, d.point)) + margin.left, y(getY(point, d.point)) + margin.top],
                seriesIndex: d.series,
                pointIndex: d.point
              });
            })
            .on('mouseover', function(d) {
              var series = getSeries(data)[d.series],
                  point  = getPoints(series, d.series)[d.point];

              dispatch.elementMouseover({
                point: point,
                series: series,
                pos: [x(getX(point, d.point)) + margin.left, y(getY(point, d.point)) + margin.top],
                seriesIndex: d.series,
                pointIndex: d.point
              });
            })
            .on('mouseout', function(d, i) {
              var series = getSeries(data)[d.series],
                  point  = getPoints(series, d.series)[d.point];

              dispatch.elementMouseout({
                point: point,
                series: series,
                seriesIndex: d.series,
                pointIndex: d.point
              });
            });

      }



      var groups = wrap.select('.nv-groups').selectAll('.nv-group')
          .data(getSeries, getSeriesKey); //TODO: wrong key is sent if series are disabled, need to figure out better way to handle disabled series!!!
      groups.enter().append('g')
          .style('stroke-opacity', 1e-6)
          .style('fill-opacity', 1e-6);
      d3.transition(groups.exit())
          .style('stroke-opacity', 1e-6)
          .style('fill-opacity', 1e-6)
          .remove();
      groups
          .attr('class', function(d,i) { return 'nv-group nv-series-' + i })
          .classed('hover', function(d) { return d.hover });
      d3.transition(groups)
          .style('fill', function(d,i) { return color(d, i) })
          .style('stroke', function(d,i) { return color(d, i) })
          .style('stroke-opacity', 1)
          .style('fill-opacity', .5);


      var points = groups.selectAll('path.nv-point')
          .data(getPoints);
      points.enter().append('path')
          .attr('transform', function(d,i) {
            return 'translate(' + x0(getX(d,i)) + ',' + y0(getY(d,i)) + ')'
          })
          .attr('d',
            d3.svg.symbol()
              .type(getShape)
              .size(function(d,i) { return z(getSize(d,i)) })
          );
      points.exit().remove();
      d3.transition(groups.exit().selectAll('path.nv-point'))
          .attr('transform', function(d,i) {
            return 'translate(' + x(getX(d,i)) + ',' + y(getY(d,i)) + ')'
          })
          .remove();
      points.attr('class', function(d,i) { return 'nv-point nv-point-' + i });
      d3.transition(points)
          .attr('transform', function(d,i) {
            return 'translate(' + x(getX(d,i)) + ',' + y(getY(d,i)) + ')'
          })
          .attr('d',
            d3.svg.symbol()
              .type(getShape)
              .size(function(d,i) { return z(getSize(d,i)) })
          );


      // Delay updating the invisible interactive layer for smoother animation
      clearTimeout(timeoutID); // stop repeat calls to updateInteractiveLayer
      timeoutID = setTimeout(updateInteractiveLayer, 1000);

      // Stash the new scales.
      this.__chart__ = {x: x.copy(), y: y.copy(), z: z.copy()};
      //this.__chart__ = {x: x, y: y, z: z};

    });

    return chart;
  }


  //============================================================
  // Event Handling/Dispatching (out of chart's scope)
  //------------------------------------------------------------

  dispatch.on('elementMouseover.point', function(d) {
    if (interactive)
      d3.select('.nv-chart-' + id + ' .nv-series-' + d.seriesIndex + ' .nv-point-' + d.pointIndex)
          .classed('hover', true);
  });

  dispatch.on('elementMouseout.point', function(d) {
    if (interactive)
      d3.select('.nv-chart-' + id + ' .nv-series-' + d.seriesIndex + ' .nv-point-' + d.pointIndex)
          .classed('hover', false);
  });

  //============================================================


  //============================================================
  // Expose Public Variables
  //------------------------------------------------------------

  chart.dispatch = dispatch;

  chart.series = function(_) {
    if (!arguments.length) return getSeries;
    getSeries = d3.functor(_);
    return chart;
  };

  chart.seriesKey = function(_) {
    if (!arguments.length) return getSeriesKey;
    if (typeof _ != 'function') //assuming if its not a function its an array of keys
      getSeriesKey = function(d,i) { return _[i] }
    else
      getSeriesKey = _;
    return chart;
  };

  chart.points = function(_) {
    if (!arguments.length) return getPoints;
    getPoints = _;
    return chart;
  };

  chart.x = function(_) {
    if (!arguments.length) return getX;
    getX = d3.functor(_);
    return chart;
  };

  chart.y = function(_) {
    if (!arguments.length) return getY;
    getY = d3.functor(_);
    return chart;
  };

  chart.size = function(_) {
    if (!arguments.length) return getSize;
    getSize = d3.functor(_);
    return chart;
  };

  chart.margin = function(_) {
    if (!arguments.length) return margin;
    margin = _;
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

  chart.xScale = function(_) {
    if (!arguments.length) return x;
    x = _;
    return chart;
  };

  chart.yScale = function(_) {
    if (!arguments.length) return y;
    y = _;
    return chart;
  };

  chart.zScale = function(_) {
    if (!arguments.length) return z;
    z = _;
    return chart;
  };

  chart.xDomain = function(_) {
    if (!arguments.length) return xDomain;
    xDomain = _;
    return chart;
  };

  chart.yDomain = function(_) {
    if (!arguments.length) return yDomain;
    yDomain = _;
    return chart;
  };

  chart.sizeDomain = function(_) {
    if (!arguments.length) return sizeDomain;
    sizeDomain = _;
    return chart;
  };

  chart.forceX = function(_) {
    if (!arguments.length) return forceX;
    forceX = _;
    return chart;
  };

  chart.forceY = function(_) {
    if (!arguments.length) return forceY;
    forceY = _;
    return chart;
  };

  chart.forceSize = function(_) {
    if (!arguments.length) return forceSize;
    forceSize = _;
    return chart;
  };

  chart.interactive = function(_) {
    if (!arguments.length) return interactive;
    interactive = _;
    return chart;
  };

  chart.pointActive = function(_) {
    if (!arguments.length) return pointActive;
    pointActive = _;
    return chart;
  };

  chart.clipEdge = function(_) {
    if (!arguments.length) return clipEdge;
    clipEdge = _;
    return chart;
  };

  chart.clipVoronoi= function(_) {
    if (!arguments.length) return clipVoronoi;
    clipVoronoi = _;
    return chart;
  };

  chart.clipRadius = function(_) {
    if (!arguments.length) return clipRadius;
    clipRadius = _;
    return chart;
  };

  chart.color = function(_) {
    if (!arguments.length) return color;
    color = nv.utils.getColor(_);
    return chart;
  };

  chart.shape = function(_) {
    if (!arguments.length) return getShape;
    getShape = _;
    return chart;
  };

  chart.id = function(_) {
    if (!arguments.length) return id;
    id = _;
    return chart;
  };

  chart.singlePoint = function(_) {
    if (!arguments.length) return singlePoint;
    singlePoint = _;
    return chart;
  };

  //============================================================


  return chart;
}
