import React, { useEffect, useRef, useState } from "react"
import mapboxgl from "mapbox-gl"
import "mapbox-gl/dist/mapbox-gl.css"
import BarLoader from "react-spinners/BarLoader"
import jenks from 'turf-jenks'

const Map = () => {

  const mapContainer = useRef(null)
  const [statefulMap, setMap] = useState(null)
  const [usStates, setUsStates] = useState([])
  const [geoJSON, setgeoJSON] = useState()
  const [stateGeoJSON, setStateGeoJSON] = useState()
  const [countyCentroidsGeoJSON, setCountyCentroidsGeoJSON] = useState()
  
  const [selectedUsState, setSelectedUsState] = useState(null)
  const [csvUrl, setCsvUrl] = useState('')

  const [loading, setLoading] = useState(false)
  const [barColor, setBarColor] = useState("#20b2aa")
  
  //populate states for the dropdown
  useEffect(() => {

    fetch("https://8450cseuue.execute-api.us-east-1.amazonaws.com/production/states")
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

    if(geoJSON && statefulMap) {
      
      // Create a popup, but don't add it to the map yet.
      const popup = new mapboxgl.Popup({
        closeButton: false,
        closeOnClick: false
      })

      let counties = { ...geoJSON }
      counties.features = counties.features.filter(feature => {
        return feature.geometry && feature.geometry.type === "MultiPolygon"
      })
      
      let points = { ...geoJSON }
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
  }, [geoJSON, statefulMap])

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
        
        let html = `<label class='popupHeader' for='popup'>County details:</label><ul id='popup' class='popup'>`
        for (const [key, value] of Object.entries(e.features[0].properties)) {
          html += `<li>${key}: ${value}</li>`
        }
        html += `</ul>`
        popup.setLngLat(coordinates).setHTML(html).addTo(statefulMap)
  
      })
  
      statefulMap.on('mouseleave', 'aoi-county-centroid-layer', () => {
        statefulMap.getCanvas().style.cursor = ''
        popup.remove()
      })
    }
  }, [countyCentroidsGeoJSON, statefulMap])

  const makeQuery = (event) => {

    if(!selectedUsState || !csvUrl) {
      alert('Please select a U.S. state and enter a url to a valid csv source.')
      return
    }
    
    setLoading(true)

    let g

    fetch("https://8450cseuue.execute-api.us-east-1.amazonaws.com/production/getGeoJsonForCsv",{
      method: 'POST',
      body: JSON.stringify({
        "csvUrl": csvUrl,
        "stusps": selectedUsState.stusps,
        "data_description": "test data"
      })
    })
    .then((res) => {
      res.json()
        .then(geojson => {
          setgeoJSON(geojson)
          g = geojson
        })
          .then(() => {
            fetch(`https://8450cseuue.execute-api.us-east-1.amazonaws.com/production/states/${selectedUsState.stusps}`)
              .then((res) => {
                res.json()
                  .then(stateBorderline => setStateGeoJSON(stateBorderline))
                    .then(() => {
                      fetch(`https://8450cseuue.execute-api.us-east-1.amazonaws.com/production/counties/${selectedUsState.stusps}`)
                        .then((res) => {
                          res.json()
                            .then((countyCentroids) => {

                              countyCentroids.features.forEach((centroid) => {
                                let match = g.features.find((feature) => {
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
          })
          .catch(error => console.log('error', error))
        .catch(error => console.log('error', error))
    })
    .catch(error => console.log('error', error))
  }

  const usStateChange = (stateAbbrev) => {
    const stateMatch = usStates.find((usState) => usState.stusps === stateAbbrev)
    setSelectedUsState(stateMatch)
  }

  const csvUrlChange = event => setCsvUrl(event.target.value)

  const barLoaderOverride = `display: block; margin: .75rem auto; width: 180px;`

  return (
    <div ref={mapContainer} className="map-container">
      <div className="ui-container">
        <div className="ui-row">
          <label htmlFor='state' >U.S. State:</label>
          <select id='state' onChange={(event) => { usStateChange(event.target.value) }} value={ selectedUsState ? selectedUsState.stusps : '' } >
            <option value=''>-Select state-</option>
            {
              usStates.map((usState, i)=> {
                return <option key={i} value={ usState.stusps }>{ usState.name }</option>
              })
            }
          </select>
        </div>
        <div className="ui-row">
          <label htmlFor='csv-url' >Source:</label>
          <input type='text' onChange={(event) => { csvUrlChange(event) }} id='csv-url' placeholder="URL source of the CSV" value={csvUrl} className='csvUrl-input' ></input>
          <button 
            onClick={(event) => { 
                usStateChange('CA')
                setCsvUrl('https://gist.githubusercontent.com/FergusDevelopmentLLC/3ae03a54f78bce4717e04618615091c2/raw/b208e1de1dfd458ec7ed185c4491169c998b2d9c/animal_hospitals_ca_trunc.csv')
              }}>
              sample data
          </button>
        </div>
        <div className="ui-row">
          <button onClick={(event) => { makeQuery(event) }}>Query!</button>
        </div>
        { loading ? <div className="ui-row"><BarLoader color={ barColor } loading={ loading } css={ barLoaderOverride } /></div> : null }
        {
          !loading && geoJSON
          ? 
          <div className="ui-row">
            <label htmlFor='geojson' >GeoJSON:</label>
            <textarea id='geojson' value={ JSON.stringify(geoJSON) } readOnly={ true }></textarea>
            <div><button onClick={() =>  navigator.clipboard.writeText(JSON.stringify(geoJSON))}>copy</button></div>
          </div>
          :
          null
        }
      </div>
    </div>
  )
}

export default Map