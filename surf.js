$(document).ready(() => {
  addBuoyForecastImages();
  generateLiveBuoyCharts();
});

window.surfJsLoaded = true;

const addBuoyForecastImages = () => {
  $('#eastBuoy1').attr(
    'src',
    `https://wsrv.nl?url=stormsurf.com/4cast/graphics/gfswave.46053.bull.4.png?disable_cache=${Date.now()}`
  );
  $('#eastBuoy2').attr(
    'src',
    `https://wsrv.nl?url=stormsurf.com/4cast/graphics/gfswave.46053.bull.5.png?disable_cache=${Date.now()}`
  );
  $('#westBuoy1').attr(
    'src',
    `https://wsrv.nl?url=stormsurf.com/4cast/graphics/gfswave.46054.bull.4.png?disable_cache=${Date.now()}`
  );
  $('#santaMonicaBuoy1').attr(
    'src',
    `https://wsrv.nl?url=stormsurf.com/4cast/graphics/gfswave.46025.bull.4.png?disable_cache=${Date.now()}`
  );
};

const fetchBuoyData = async (buoyUuid) => {
  let days = 3;
  if (window.innerWidth <= 500 || (window.innerWidth < 991 && window.innerWidth > 768)) days = 2;
  const url = `https://services.surfline.com/kbyg/buoys/report/${buoyUuid}?days=${days}`;
  const response = await window.fetch(url);
  const jsonResponse = await response.json();
  return jsonResponse.data;
};

const generateLiveBuoyCharts = async () => {
  const buoys = [
    { id: '46053', uuid: '9897640a-cecd-11eb-a2c9-024238d3b313', displayName: 'East Santa Barbara' },
    { id: '46054', uuid: '56d24394-cecc-11eb-ab23-024238d3b313', displayName: 'West Santa Barbara' },
    { id: '46218', uuid: 'c795cab8-cecc-11eb-84e7-024238d3b313', displayName: 'Harvest' },
    { id: '46006', uuid: 'a03ee0b8-cecd-11eb-834b-024238d3b313', displayName: 'Southeast Papa - NorCal Open Ocean' },
    { id: '46025', uuid: '1b3c155c-cecc-11eb-bbec-024238d3b313', displayName: 'Santa Monica Basin - LA' },
    { id: '46086', uuid: '62dfcbfe-cecc-11eb-a7ce-024238d3b313', displayName: 'San Clemente Basin - OC' },
  ];
  buoys.forEach(async (buoy) => {
    const buoyData = await fetchBuoyData(buoy.uuid);
    createLiveBuoyChart(buoy, buoyData);
  });
};

const createLiveBuoyChart = (buoy, buoyData) => {
  const combinedHeightDataset = {
    data: [],
    label: 'Combined Height',
    borderColor: '#5b5b5b',
    backgroundColor: '#5b5b5b',
    borderWidth: 5,
    pointRadius: 0,
    tension: 0.5,
  };
  let swellDatasets = {};
  const dates = [];
  const waterTemps = [];
  buoyData.forEach((datapoint) => {
    const date = new Date(datapoint.timestamp * 1000);
    // There is often duplicate data at 40 and 50 minute marks, so only use one.
    if (date.getMinutes() === 40) return;

    dates.push(date);
    if (datapoint.waterTemperature) waterTemps.push(datapoint.waterTemperature);
    // Add a data point for the combined height.
    combinedHeightDataset.data.push({
      x: date,
      y: datapoint.height,
    });
    // Add a data point for each individual swell.
    datapoint.swells.forEach((swell) => {
      const approximateDirection = swell.direction >= 240 ? 'W' : 'S';
      const swellType = periodToSwellType(swell.period);
      const compassDirection = degreeToCompass(swell.direction);
      let key = `${approximateDirection}${swellType.key}`;
      // Ignore unimportant swell readings.
      if (swell.period < 4 || swell.height < 0.5) return;
      if (approximateDirection === 'S' && swellType.key === 'spws') return;

      // It isn't working to have multiple datapoints for a given dataset on the same date,
      // so use a separate key for these extra datapoints
      if (swellDatasets[key] && swellDatasets[key].data.find((dp) => dp.x === date)) {
        key = key + '_secondary';
        if (swellDatasets[key] && swellDatasets[key].data.find((dp) => dp.x === date)) {
          key = key + '_tertiary';
        }
      }

      // Create a new dataset for the swell type if it doesn't already exist.
      if (!swellDatasets[key]) {
        swellDatasets[key] = {
          data: [],
          borderColor: swellType.color,
          backgroundColor: swellType.color,
          tension: 0.5,
          spanGaps: false,
        };
      }

      // Add the datapoint to the dataset.
      swellDatasets[key].data.push({
        x: date,
        y: swell.height,
        label: `${swell.period}s - ${compassDirection} (${swell.direction}°)`,
        ...swell,
      });
    });
  });
  swellDatasets = Object.values(swellDatasets);
  swellDatasets.map((dataset) => {
    const minDir = Math.min(...dataset.data.map((swell) => swell.direction));
    const maxDir = Math.max(...dataset.data.map((swell) => swell.direction));
    dataset.label = `${periodToSwellType(dataset.data[0].period).displayName} | ${degreeToCompass(
      minDir
    )} (${minDir}°) - ${degreeToCompass(maxDir)} (${maxDir}°)`;
    dates.forEach((date, index) => {
      const existingDatapoint = dataset.data.find((dp) => dp.x === date);
      if (!existingDatapoint) dataset.data.splice(index, 0, { x: date, y: NaN });
    });
    return dataset;
  });
  createAndAttachChart(buoy, [combinedHeightDataset, ...swellDatasets]);
  createAndAttachLatestSwellReadings(buoy, dates, swellDatasets, waterTemps[0]);
};

const createAndAttachLatestSwellReadings = (buoy, dates, swellDatasets, waterTemp) => {
  const date = dates[0];
  const lastUpdatedDate = date.toLocaleString('en-US', { hour: 'numeric', minute: 'numeric', hour12: true });
  $(`#latestSwellReadings-${buoy.id}`).prepend(`<li class='updated-at'>Last update: ${lastUpdatedDate}</li>`);
  swellDatasets.forEach((dataset) => {
    const datapoint = dataset.data[0];
    if (datapoint.x === date && datapoint.y) {
      $(`#latestSwellReadings-${buoy.id}`).append(`
        <li>
          <span class='dot' style='background-color: ${dataset.backgroundColor}'></span>
          ${datapoint.y}ft @ ${datapoint.label}
        </li>
      `);
    }
  });
  $(`#latestSwellReadings-${buoy.id}`).append(`
    <li class='water-temp'>
      <img class='waterdrop' src='https://jeremykirc.github.io/surf/waterdrop.png'></img>
      <span>${waterTemp}°</span>
    </li>
  `);
};

const createAndAttachChart = (buoy, datasets) => {
  const ctx = document.getElementById(`buoyChart-${buoy.id}`).getContext('2d');
  Chart.register(verticalLineChartPlugin);
  new Chart(ctx, {
    type: 'line',
    data: { datasets },
    options: {
      scales: {
        x: {
          type: 'time',
          time: {
            unit: 'hour',
            displayFormats: {
              hour: 'ccc h a',
            },
            tooltipFormat: 'cccc M/d - h:mm a',
            stepSize: 4,
          },
        },
        y: {
          beginAtZero: true,
          ticks: {
            callback: (value, _index, _values) => `${value}ft`,
          },
        },
      },
      interaction: {
        mode: 'index',
        intersect: false,
      },
      plugins: {
        title: {
          display: true,
          text: `${buoy.displayName} (${buoy.id})`,
          font: {
            size: 16,
          },
        },
        tooltip: {
          callbacks: {
            labelColor: (context) => {
              const { borderColor, backgroundColor } = { ...context.dataset };
              return {
                borderWidth: 1,
                borderColor,
                backgroundColor,
              };
            },
            label: (context) => {
              let label = `${context.parsed.y}ft`;
              if (context.raw.label) {
                label += ` @ ${context.raw.label}`;
              } else {
                label += ' Combined Height';
              }
              return label;
            },
          },
        },
      },
    },
  });
};

const periodToSwellType = (period) => {
  if (period <= 6) {
    return { key: 'spws', displayName: 'Short Period Windswell', color: '#0000ff' };
  } else if (period <= 9) {
    return { key: 'ws', displayName: 'Windswell', color: '#00b7ff' };
  } else if (period <= 12) {
    return { key: 'mps', displayName: 'Mid Period Swell', color: '#ffca00' };
  } else if (period <= 17) {
    return { key: 'gs', displayName: 'Groundswell', color: '#ff8223' };
  } else {
    return { key: 'lpgs', displayName: 'Long Period Groundswell', color: '#e60000' };
  }
};

const degreeToCompass = (deg) => {
  const val = Math.floor(deg / 22.5 + 0.5);
  const directions = [
    'N',
    'NNE',
    'NE',
    'ENE',
    'E',
    'ESE',
    'SE',
    'SSE',
    'S',
    'SSW',
    'SW',
    'WSW',
    'W',
    'WNW',
    'NW',
    'NNW',
  ];
  return directions[val % 16];
};

const verticalLineChartPlugin = {
  id: 'verticalLine',
  afterDraw: (chart) => {
    if (chart.tooltip?._active?.length) {
      let x = chart.tooltip._active[0].element.x;
      let yAxis = chart.scales.y;
      let ctx = chart.ctx;
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(x, yAxis.top);
      ctx.lineTo(x, yAxis.bottom);
      ctx.lineWidth = 2;
      ctx.strokeStyle = 'lightgrey';
      ctx.stroke();
      ctx.restore();
    }
  },
};
