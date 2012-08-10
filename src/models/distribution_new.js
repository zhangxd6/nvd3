
nv.models.distribution = function() {
  var margin = {top: 0, right: 0, bottom: 0, left: 0},
      width = 400, //technically width or height depending on x or y....
      size = 8,
      axis = 'x', // 'x' or 'y'... horizontal or vertical
      getData = function(d) { return d[axis] },  // defaults d.x or d.y
      getSeries   = function(d) { return d }, // accessor to get the array of series from the initial data structure provided
      getPoints   = function(d) { return d.values }, // accessor to get the array of pointd from the array of series
      color = nv.utils.defaultColor(),
      domain;

  var scale = d3.scale.linear(),
      scale0;

  function chart(selection) {
    selection.each(function(data) {
      var availableLength = width - (axis === 'x' ? margin.left + margin.right : margin.top + margin.bottom),
          naxis = axis == 'x' ? 'y' : 'x';


      //store old scales if they exist
      scale0 = scale0 || scale;

/*
      scale
          .domain(domain || d3.extent(data, getData))
          .range(axis == 'x' ? [0, availableLength] : [availableLength,0]);
*/


      var wrap = d3.select(this).selectAll('g.nv-distribution').data([data]);
      var wrapEnter = wrap.enter().append('g').attr('class', 'nvd3 nv-distribution');
      var gEnter = wrapEnter.append('g');
      var g = wrap.select('g');

      wrap.attr('transform', 'translate(' + margin.left + ',' + margin.top + ')')

      var distWrap = g.selectAll('g.nv-dist')
          .data(getSeries, function(d) { return d.key });

      distWrap.enter().append('g')
      distWrap
          .attr('class', function(d,i) { return 'nv-dist nv-series-' + i })
          .style('stroke', function(d,i) { return color(d, i) })
          .style('stroke-opacity', function(d,i) { return d.disabled ? 0 : 1 }) //TODO: this hides disabled lines, when ideally it would not plot them for performance reasons
          //.style('stroke', function(d,i) { return color.filter(function(d,i) { return data[i] && !data[i].disabled })[i % color.length] });

      var dist = distWrap.selectAll('line.nv-dist' + axis)
          .data(getPoints)
      dist.enter().append('line')
          .attr(axis + '1', function(d,i) { return scale0(getData(d,i)) })
          .attr(axis + '2', function(d,i) { return scale0(getData(d,i)) })
      d3.transition(distWrap.exit().selectAll('line.nv-dist' + axis))
          .attr(axis + '1', function(d,i) { return scale(getData(d,i)) })
          .attr(axis + '2', function(d,i) { return scale(getData(d,i)) })
          .style('stroke-opacity', 0)
          .remove();
      dist
      //distWrap.selectAll('line.dist' + axis)
          .attr('class', function(d,i) { return 'nv-dist' + axis + ' nv-dist' + axis + '-' + i })
          .attr(naxis + '1', 0)
          .attr(naxis + '2', size);
      d3.transition(dist)
      //d3.transition(distWrap.selectAll('line.dist' + axis))
          .attr(axis + '1', function(d,i) { return scale(getData(d,i)) })
          .attr(axis + '2', function(d,i) { return scale(getData(d,i)) })


      scale0 = scale.copy();

    });

    return chart;
  }


  chart.series = function(_) {
    if (!arguments.length) return getSeries;
    getSeries = _;
    return chart;
  };

  chart.points = function(_) {
    if (!arguments.length) return getPoints;
    getPoints = _;
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

  chart.axis = function(_) {
    if (!arguments.length) return axis;
    axis = _;
    return chart;
  };

  chart.size = function(_) {
    if (!arguments.length) return size;
    size = _;
    return chart;
  };

  chart.getData = function(_) {
    if (!arguments.length) return getData;
    getData = d3.functor(_);
    return chart;
  };

  chart.scale = function(_) {
    if (!arguments.length) return scale;
    scale = _;
    return chart;
  };

  chart.color = function(_) {
    if (!arguments.length) return color;
    color = nv.utils.getColor(_);
    return chart;
  };

  return chart;
}
