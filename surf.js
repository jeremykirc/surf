$(document).ready(function() {
  var date = new Date();
  var year = date.getFullYear();
  var month = date.getMonth() + 1;
  var day = date.getDate();
  var todaySrc = 'http://tides-ext.surfline.com/cgi-bin/tidepng.pl?location=Rincon Island, California&startyear=' + year + '&startmonth=' + month + '&startday=' + day + '&units=feet';
  $('#tide-chart-today').attr('src', todaySrc);
  var tomorrowSrc = 'http://tides-ext.surfline.com/cgi-bin/tidepng.pl?location=Rincon Island, California&startyear=' + year + '&startmonth=' + month + '&startday=' + (day + 1) + '&units=feet';
  $('#tide-chart-tomorrow').attr('src', tomorrowSrc);
});
