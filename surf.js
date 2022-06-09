$(document).ready(() => {
  getTideCharts();
  generateLiveBuoyCharts();
});

const swellTypeToColorMap = {
  spws: '#0000ff',
  ws: '#00b7ff',
  gs: '#ffca00',
  mpgs: '#ff4800',
  lpgs: '#e60000',
};

const getTideCharts = () => {
  const date = new Date();
  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  const day = date.getDate();
  const todaySrc = 'http://tides-ext.surfline.com/cgi-bin/tidepng.pl?location=Rincon Island, California&startyear=' + year + '&startmonth=' + month + '&startday=' + day + '&units=feet';
  $('#tide-chart-today').attr('src', todaySrc);
  const tomorrowSrc = 'http://tides-ext.surfline.com/cgi-bin/tidepng.pl?location=Rincon Island, California&startyear=' + year + '&startmonth=' + month + '&startday=' + (day + 1) + '&units=feet';
  $('#tide-chart-tomorrow').attr('src', tomorrowSrc);
};

const fetchBuoyData = async (buoyUuid) => {
  const url = `https://services.surfline.com/kbyg/buoys/report/${buoyUuid}?days=2`;
  const response = await window.fetch(url);
  const jsonResponse = await response.json();
  return jsonResponse.data;
};

const generateLiveBuoyCharts = async () => {
  const buoys = [
    { id: '46053', uuid: '9897640a-cecd-11eb-a2c9-024238d3b313', displayName: 'East Santa Barbara' },
    { id: '46054', uuid: '56d24394-cecc-11eb-ab23-024238d3b313', displayName: 'West Santa Barbara' },
    { id: '46218', uuid: 'c795cab8-cecc-11eb-84e7-024238d3b313', displayName: 'Harvest' },
    { id: '46059', uuid: '7e932ed8-54b8-11ec-84b6-06dc30ac5823', displayName: 'West California' },
    { id: '46025', uuid: '1b3c155c-cecc-11eb-bbec-024238d3b313', displayName: 'Santa Monica Basin' },
    { id: '46086', uuid: '62dfcbfe-cecc-11eb-a7ce-024238d3b313', displayName: 'San Clemente Basin' },
  ];
  buoys.forEach(async buoy => {
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
  buoyData.forEach(datapoint => {
    const date = new Date(datapoint.timestamp * 1000);
    // There is often duplicate data at 40 and 50 minute marks, so only use one.
    if (date.getMinutes() === 40) return;

    dates.push(date);
    // Add a data point for the combined height.
    combinedHeightDataset.data.push({
      x: date,
      y: datapoint.height,
    });
    // Add a data point for each individual swell.
    datapoint.swells.forEach(swell => {
      const approximateDirection = swell.direction >= 240 ? 'W' : 'S';
      const swellType = periodToSwellType(swell.period);
      const compassDirection = degreeToCompass(swell.direction);
      const key = `${approximateDirection}${swellType.key}`;
      // Ignore unimportant swell readings.
      if (swell.direction < 150 || swell.period < 4 || swell.height < 0.5) return;
      if (approximateDirection === 'S' && swellType.key === 'spws') return;

      // Create a new dataset for the swell type if it doesn't already exist.
      if (!swellDatasets[key]) {
        swellDatasets[key] = {
          data: [],
          borderColor: swellTypeToColorMap[swellType.key],
          backgroundColor: swellTypeToColorMap[swellType.key],
          tension: 0.5,
          spanGaps: false,
        };
      }
      // Only keep the largest datapoint for each swell type + timestamp.
      const existingDatapoint = swellDatasets[key].data.find(dp => dp.x === date);
      if (existingDatapoint) {
        if (existingDatapoint.height >= swell.height) {
          return;
        } else if (existingDatapoint.height < swell.height) {
          swellDatasets[key].data.splice(swellDatasets[key].data.indexOf(existingDatapoint));
        };
      }

      // Add the datapoint to the dataset.
      swellDatasets[key].data.push({
        x: date,
        y: swell.height,
        label: `${swell.period}s - ${compassDirection} (${swell.direction}°)`,
        ...swell
      });
    });
  });
  swellDatasets = Object.values(swellDatasets);
  swellDatasets.map(dataset => {
    const minDir = Math.min(...dataset.data.map(swell => swell.direction));
    const maxDir = Math.max(...dataset.data.map(swell => swell.direction));
    dataset.label = `${periodToSwellType(dataset.data[0].period).displayName} | ${degreeToCompass(minDir)} (${minDir}°) - ${degreeToCompass(maxDir)} (${maxDir}°)`
    dates.forEach((date, index) => {
      const existingDatapoint = dataset.data.find(dp => dp.x === date);
      if (!existingDatapoint) dataset.data.splice(index, 0, { x: date, y: NaN });
    })
    return dataset;
  });
  createAndAttachChart(buoy, [combinedHeightDataset, ...swellDatasets]);
  createAndAttachLatestSwellReadings(buoy, dates, swellDatasets, buoyData[0].waterTemperature);
};

const createAndAttachLatestSwellReadings = (buoy, dates, swellDatasets, waterTemp) => {
  const date = dates[0];
  const lastUpdatedDate = date.toLocaleString('en-US', { hour: 'numeric', minute: 'numeric', hour12: true });
  $(`#latestSwellReadings-${buoy.id}`).prepend(`<li class='updated-at'>Last update: ${lastUpdatedDate}</li>`);
  swellDatasets.forEach(dataset => {
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
  // $(`#latestSwellReadings-${buoy.id}`).append(`<li class='water-temp'>Water Temp. ${waterTemp}°</li>`);
};

const createAndAttachChart = (buoy, datasets) => {
  const ctx = document.getElementById(`buoyChart-${buoy.id}`).getContext('2d');
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
              hour: 'ccc h a'
            },
            tooltipFormat: "cccc M/d - h:mm a",
            stepSize: 4
          }
        },
        y: {
          beginAtZero: true,
          ticks: {
            callback: (value, _index, _values) => `${value}ft`
          },
        }
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
            label: context => {
              let label = `${context.parsed.y}ft`;
              if (context.raw.label) label += ` @ ${context.raw.label}`;
              return label;
            }
          }
        }
      }
    }
  });
}

const periodToSwellType = period => {
  if (period <= 6) {
    return { key: 'spws', displayName: 'Short Period Windswell' };
  } else if (period <= 10) {
    return { key: 'ws', displayName: 'Windswell' };
  } else if (period <= 17) {
    return { key: 'gs', displayName: 'Groundswell' };
  } else {
    return { key: 'lpgs', displayName: 'Long Period Groundswell' };
  }
};

const degreeToCompass = deg => {
  const val = Math.floor((deg / 22.5) + 0.5);
  const directions = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
  return directions[(val % 16)];
};
