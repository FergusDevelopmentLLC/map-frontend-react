import "mapbox-gl/dist/mapbox-gl.css"
import React, { useEffect, useRef, useState } from "react"
import mapboxgl from "mapbox-gl"
import BarLoader from "react-spinners/BarLoader"
import jenks from 'turf-jenks'

const Map = () => {

  const mapContainer = useRef(null)
  
  const [statefulMap, setMap] = useState(null)
  const [usStates, setUsStates] = useState([])
  const [countiesPointsGeoJSON, setCountiesPointsGeoJSON] = useState()
  const [stateGeoJSON, setStateGeoJSON] = useState()
  const [countyCentroidsGeoJSON, setCountyCentroidsGeoJSON] = useState()
  
  const [selectedUsState, setSelectedUsState] = useState(null)
  const [csvUrl, setCsvUrl] = useState('')
  const [dataDescription, setDataDescription] = useState('')
  const [showPoints, setShowPoints] = useState(true)
  const [showCounties, setShowCounties] = useState(true)

  const [loading, setLoading] = useState(false)
  const [barColor, setBarColor] = useState("#20b2aa")
  
  const apiPrefix = 'https://tukrsrpa30.execute-api.us-east-1.amazonaws.com/production/'
  //const apiPrefix = 'http://localhost:3000/production'

  //populate states for the dropdown
  useEffect(() => {

    fetch(`${apiPrefix}/states`)
      .then((res) => {
        res.json()
          .then(usStates => {
            setUsStates(usStates)
          })
          .catch(error => console.log('error', error))
      })
      .catch(error => console.log('error', error))

  }, [])

  //initialize map
  useEffect(() => {

    const initializeMap = () => {

      mapboxgl.accessToken = 'pk.eyJ1Ijoid2lsbGNhcnRlciIsImEiOiJjamV4b2g3Z2ExOGF4MzFwN3R1dHJ3d2J4In0.Ti-hnuBH8W4bHn7k6GCpGw'
            
      const mapboxGlMap = new mapboxgl.Map({
        container: mapContainer.current,
        style: `mapbox://styles/mapbox/light-v10`,
        center: [-96.410, 41.399],
        zoom: 3,
        attributionControl: false
      })

      mapboxGlMap.on('moveend', () =>  setLoading(false))

      setMap(mapboxGlMap)
    }

    if (!statefulMap) {
      initializeMap()
    }
  
  }, [statefulMap])

  //populate map with counties
  useEffect(() => {
    
    const fetchStateBorderAndCountyCentroids = () => {

      fetch(`${apiPrefix}/states/${selectedUsState.stusps}`)
        .then((res) => {
          res.json()
            .then(stateBorderline => setStateGeoJSON(stateBorderline))
              .then(() => {
                fetch(`${apiPrefix}/counties/${selectedUsState.stusps}`)
                  .then((res) => {
                    res.json()
                      .then((countyCentroids) => {
  
                        //merge the county polygon data (persons_per_point, etc)
                        countyCentroids.features.forEach((centroid) => {
                          let match = countiesPointsGeoJSON.features.find((feature) => {
                            return feature.properties.countyfp === centroid.properties.countyfp
                          })
                          if(match) {
                            centroid.properties = {
                              ...centroid.properties,
                              ...match.properties
                            }
                          }
                        })
  
                        setCountyCentroidsGeoJSON(countyCentroids)
  
                        let zoom = 6
                        if(selectedUsState.stusps === 'CA') zoom = 5
                        if(selectedUsState.stusps === 'TX') zoom = 5
                        if(selectedUsState.stusps === 'AK') zoom = 4
  
                        statefulMap.flyTo({
                          center: [selectedUsState.centroid_longitude, selectedUsState.centroid_latitude],
                          zoom: zoom,
                          essential: true
                        })
                      
                      })
                      .catch((error) => {
                        console.log('error', error)
                      })
                  .catch((error) => {
                    console.log('error', error)
                  })
                })
              })
              .catch((error) => {
                console.log('error', error)
              })
            .catch((error) => {
              console.log('error', error)
            })
        })
        .catch((error) => {
          console.log('error', error)
        })
    }

    if(countiesPointsGeoJSON && statefulMap) {
      
      fetchStateBorderAndCountyCentroids()

      // Create a popup, but don't add it to the map yet.
      const popup = new mapboxgl.Popup({
        closeButton: false,
        closeOnClick: false
      })

      let counties = { ...countiesPointsGeoJSON }
      counties.features = counties.features.filter(feature => {
        return feature.geometry && feature.geometry.type === "MultiPolygon"
      })
      
      let points = { ...countiesPointsGeoJSON }
      points.features = points.features.filter(feature => {
        return feature.geometry && feature.geometry.type === "Point"
      })

      //remove any previous state data, if present
      if (statefulMap.getLayer('aoi-counties-layer')) statefulMap.removeLayer('aoi-counties-layer')
      if (statefulMap.getSource('aoi-source-counties')) statefulMap.removeSource('aoi-source-counties')

      if (statefulMap.getLayer('aoi-points-layer')) statefulMap.removeLayer('aoi-points-layer')
      if (statefulMap.getSource('aoi-source-points')) statefulMap.removeSource('aoi-source-points')
      
      statefulMap.addSource('aoi-source-counties', {
        type: 'geojson',
        data: counties
      })

      statefulMap.addSource('aoi-source-points', {
        type: 'geojson',
        data: points
      })
      
      const colors = ['#f7fcf5','#c9eac2','#7bc77c','#2a924b','#00441b']
      const breaks = jenks(counties,'persons_per_point', colors.length)

      let breaksInsert = []
      for (let i = 1; i < colors.length; i++) {
        breaksInsert.push(`${breaks[i]},"${colors[i]}"`)
      }
      
      const countyPaint = `
      {
        "fill-color": [
        "interpolate",
        ["linear"],
        ["get", "persons_per_point"],
        0,
        "${colors[0]}",
        ${breaksInsert.join(',')}
        ],
        "fill-opacity": 0.6,
        "fill-outline-color": "#1f3c84"
      }`.trim()

      statefulMap.addLayer({
        id: 'aoi-counties-layer',
        source: 'aoi-source-counties',
        type: 'fill',
        paint: JSON.parse(countyPaint)
      })
      
      statefulMap.addLayer({
        id: 'aoi-points-layer',
        source: 'aoi-source-points',
        type: 'circle',
        paint: {
          'circle-radius': 2,
          'circle-color': 'orange',
          'circle-stroke-color': 'red',
          'circle-stroke-width': 1,
          'circle-opacity': 0.75
        }
      })

      statefulMap.on('mouseenter', 'aoi-points-layer', (e) => {

        statefulMap.getCanvas().style.cursor = 'pointer'
        
        let coordinates = e.features[0].geometry.coordinates
        
        let html = `<label class='popupHeader' for='popup'>Location details:</label><ul id='popup' class='popup'>`
        for (const [key, value] of Object.entries(e.features[0].properties)) {
          html += `<li>${key}: ${value}</li>`
        }
        html += `</ul>`
        popup.setLngLat(coordinates).setHTML(html).addTo(statefulMap)
  
      })
  
      statefulMap.on('mouseleave', 'aoi-points-layer', () => {
        statefulMap.getCanvas().style.cursor = ''
        popup.remove()
      })

    }
  }, [countiesPointsGeoJSON, statefulMap, selectedUsState])

  //show state outline
  useEffect(() => {

    if(stateGeoJSON && statefulMap) {

      if (statefulMap.getLayer('aoi-state-layer')) statefulMap.removeLayer('aoi-state-layer')
      if (statefulMap.getSource('aoi-source-state')) statefulMap.removeSource('aoi-source-state')

      statefulMap.addSource('aoi-source-state', {
        type: 'geojson',
        data: stateGeoJSON
      })

      statefulMap.addLayer({
        id: 'aoi-state-layer',
        source: 'aoi-source-state',
        type: 'line',
        paint: {
          'line-color': '#355e92',
          'line-width': 3
        }
      })
    }

  }, [stateGeoJSON, statefulMap])

  //show invisble county centroids, used for showing popup
  useEffect(() => {
    
    // Create a popup, but don't add it to the map yet.
    const popup = new mapboxgl.Popup({
      closeButton: false,
      closeOnClick: false
    })

    if(countyCentroidsGeoJSON && statefulMap) {

      if (statefulMap.getLayer('aoi-county-centroid-layer')) statefulMap.removeLayer('aoi-county-centroid-layer')
      if (statefulMap.getSource('aoi-source-county-centroid')) statefulMap.removeSource('aoi-source-county-centroid')

      statefulMap.addSource('aoi-source-county-centroid', {
        type: 'geojson',
        data: countyCentroidsGeoJSON
      })

      statefulMap.addLayer({
        id: 'aoi-county-centroid-layer',
        source: 'aoi-source-county-centroid',
        type: 'circle',
        paint: {
          'circle-radius': 15,
          'circle-opacity': 0
        }
      })

      statefulMap.on('mouseenter', 'aoi-county-centroid-layer', (e) => {

        statefulMap.getCanvas().style.cursor = 'pointer'
        
        let coordinates = e.features[0].geometry.coordinates
        
        let html = `<ul id='popup' class='popup'>`
        const columnsToDisplay = ['name', 'pop_2019', 'geo_points_count', 'persons_per_point']
        const columnNames = ['county', 'pop 2019', 'points_count', 'persons_per_point']

        columnsToDisplay.forEach((column, i) => {
          if(columnNames[i] === 'county')
            html += `<li><strong>${e.features[0].properties[column]} County</strong></li>`
          else
            html += `<li>${columnNames[i]}: ${e.features[0].properties[column].toLocaleString()}</li>`
        })

        html += `</ul>`
        popup.setLngLat(coordinates).setHTML(html).addTo(statefulMap)
  
      })
  
      statefulMap.on('mouseleave', 'aoi-county-centroid-layer', () => {
        statefulMap.getCanvas().style.cursor = ''
        popup.remove()
      })
    }
  }, [countyCentroidsGeoJSON, statefulMap])

  //watch for show/hide points
  useEffect(() => {

    if(statefulMap) {

      let pointsLayer = statefulMap.getLayer('aoi-points-layer')

      if(pointsLayer) {
        if (showPoints === false)
          statefulMap.setLayoutProperty('aoi-points-layer', 'visibility', 'none')
        else 
          statefulMap.setLayoutProperty('aoi-points-layer', 'visibility', 'visible')
      }
    }
  }, [showPoints, statefulMap])

  //watch for show/hide counties
  useEffect(() => {

    if(statefulMap) {

      let countiesLayer = statefulMap.getLayer('aoi-counties-layer')
      let countiesCentroidsLayer = statefulMap.getLayer('aoi-county-centroid-layer')
      
      if(countiesLayer) {
        if (showCounties === false) {
          statefulMap.setLayoutProperty('aoi-counties-layer', 'visibility', 'none')
          
          if(countiesCentroidsLayer) 
            statefulMap.setLayoutProperty('aoi-county-centroid-layer', 'visibility', 'none')
        }
        else {
          statefulMap.setLayoutProperty('aoi-counties-layer', 'visibility', 'visible')

          if(countiesCentroidsLayer) 
            statefulMap.setLayoutProperty('aoi-county-centroid-layer', 'visibility', 'visible')
        }
      }
    }
  }, [showCounties, statefulMap])

  const queryAPI = (event) => {

    if(!selectedUsState || !csvUrl || !dataDescription) {
      alert('Please select a U.S. state, a url to a valid csv source and a short description of your data.')
      return
    }
    
    setLoading(true)

    console.log('csvUrl', csvUrl)
    console.log('selectedUsState.stusps', selectedUsState.stusps)
    console.log('dataDescription', dataDescription)

    fetch(`${apiPrefix}/getGeoJsonForCsv`,{
      method: 'POST',
      body: JSON.stringify({
        "csvUrl": csvUrl,
        "stusps": selectedUsState.stusps,
        "data_description": dataDescription
      })
    })
    .then((res) => {
      console.log('here1')
      res.json()
        .then(countiesPoints => setCountiesPointsGeoJSON(countiesPoints))
        .catch(error => console.log('error', error))
    })
    .catch(error => {
      console.log('here2')
      console.log('error', error)
    })
  }

  const usStateChange = (stateAbbrev) => {
    if(stateAbbrev === 'all') {
      setSelectedUsState({
        "stusps": "all"
      })
    }
    else {
      const stateMatch = usStates.find((usState) => usState.stusps === stateAbbrev)
      setSelectedUsState(stateMatch)
    }
    setCountiesPointsGeoJSON(null)
  }

  const barLoaderOverride = `display: block; margin: .75rem auto; width: 180px;`

  return (
    <div ref={mapContainer} className="map-container">
      <div className="ui-container">
        <div className="ui-row">
          <label htmlFor='state' >U.S. State of interest:</label>
          <select id='state' onChange={(event) => { usStateChange(event.target.value) }} value={ selectedUsState ? selectedUsState.stusps : '' } >
            <option value=''>-Select state-</option>
            {/* <option value='all'>All</option> */}
            {
              usStates.map((usState, i)=> {
                return <option key={i} value={ usState.stusps }>{ usState.name }</option>
              })
            }
          </select>
        </div>
        <div className="ui-row">
          <label htmlFor='csv-url' >CSV source url:</label>
          <input type='text' onChange={(event) => { setCsvUrl(event.target.value) }} id='csv-url' placeholder="URL source of the CSV" value={csvUrl} className='csvUrl-input' ></input>
        </div>
        <div className="ui-row">
          <label htmlFor='data-description' >Data description:</label>
          <input type='text' onChange={(event) => { setDataDescription(event.target.value) }} id='data-description' placeholder="Short description of data" value={dataDescription} ></input>
        </div>
        <div className="ui-row">
          <button onClick={(event) => { queryAPI(event) }} className='btn-query'>Query!</button>
          <button 
            onClick={(event) => { 
                usStateChange('CA')
                setCsvUrl('https://gist.githubusercontent.com/FergusDevelopmentLLC/2d2ef2fe6bf41bb7f10cb7a87efbb803/raw/1aaea6621e64892fd1fc9642bb14a729c892ffe8/animal_hospitals_ca.csv')
                setDataDescription('Animal hospitals in CA')
              }}>
              Try sample data
          </button>
        </div>
        { loading ? <div className="ui-row"><BarLoader color={ barColor } loading={ loading } css={ barLoaderOverride } /></div> : null }
        {
          !loading && countiesPointsGeoJSON
          ?
          <div>
            <div className="ui-row">
              <div><button onClick={() => navigator.clipboard.writeText(JSON.stringify(countiesPointsGeoJSON))}>copy GeoJSON</button></div>
            </div>
            <div className="ui-row">
              <div id='points-counties' className="points-counties-row">
                <div>
                  <label className="checkbox-label" htmlFor="show-points">
                    <input type="checkbox" id="show-points" name="points" checked={ showPoints ? `checked` : ''} onChange={(event) => { setShowPoints(event.target.checked) }} />points
                  </label>
                </div>
                <div>
                  <label className="checkbox-label" htmlFor="show-counties">
                    <input type="checkbox" id="show-counties" name="counties" checked={ showCounties ? `checked` : ''} onChange={(event) => { setShowCounties(event.target.checked) }} />counties
                  </label>
                </div>
              </div>
              
            </div>
          </div>
          :
          null
        }
      </div>
    </div>
  )
}

export default Map