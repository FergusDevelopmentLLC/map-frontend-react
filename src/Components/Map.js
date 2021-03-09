import React, { useEffect, useRef, useState } from "react"
import mapboxgl from "mapbox-gl"
import "mapbox-gl/dist/mapbox-gl.css"
import BarLoader from "react-spinners/BarLoader";

const Map = () => {

  const mapContainer = useRef(null)
  const [statefulMap, setMap] = useState(null)
  const [usStates, setUsStates] = useState([])
  const [geoJSON, setgeoJSON] = useState()
  const [selectedUsState, setSelectedUsState] = useState(null)
  const [csvUrl, setCsvUrl] = useState('')

  const [loading, setLoading] = useState(false)
  const [barColor, setBarColor] = useState("#20b2aa")

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

      mapboxGlMap.on("load", () => {
        console.log('map load')
      })

      mapboxGlMap.on('moveend', () => {
        setLoading(false)
      })

      setMap(mapboxGlMap)
    }

    console.log('statefulMap', statefulMap)

    if (!statefulMap) {
      initializeMap()
    }
    else {
      if(geoJSON) {

        let counties = { ...geoJSON }
        counties.features = counties.features.filter(feature => feature.geometry.type === "MultiPolygon")
        
        let points = { ...geoJSON }
        points.features = points.features.filter(feature => feature.geometry.type === "Point")

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
        
        const maxPersonPerPoint = counties.features.reduce((acc, feature) => {
          if(feature.properties.persons_per_point > acc) acc = feature.properties.persons_per_point
          return acc
        }, 0)

        statefulMap.addLayer({
          id: 'aoi-counties-layer',
          source: 'aoi-source-counties',
          type: 'fill',
          paint: {
            'fill-color': [
            'interpolate',
            ['linear'],
            ['get', 'persons_per_point'],
            0,
            '#c7e9c0',
            maxPersonPerPoint,
            '#006d2c'
            ],
            'fill-opacity': 0.75
          }
        })

        statefulMap.addLayer({
          id: 'aoi-points-layer',
          source: 'aoi-source-points',
          type: 'circle',
          paint: {
            'circle-radius': 3,
            'circle-color': '#223b53',
            'circle-stroke-color': 'white',
            'circle-stroke-width': 1,
            'circle-opacity': 0.5
          }
        })

        
      }
    }

  }, [statefulMap, geoJSON])

  //populate states
  useEffect(() => {

    fetch("https://8450cseuue.execute-api.us-east-1.amazonaws.com/production/states")
      .then((res) => {
        res.json()
          .then(usStates => setUsStates(usStates))
          .catch(error => console.log('error', error))
      })
      .catch(error => console.log('error', error))

  }, [])

  const makeQuery = (event) => {

    if(!selectedUsState || !csvUrl) {
      alert('Please select a U.S. state and enter a url to a valid csv source.')
      return
    }
    
    setLoading(true)

    fetch("https://8450cseuue.execute-api.us-east-1.amazonaws.com/production/getGeoJsonForCsv",{
      method: 'POST',
      body: JSON.stringify({
        "csvUrl": "https://gist.githubusercontent.com/FergusDevelopmentLLC/b95090d5c494ced48a1610c3e954a382/raw/1ef9f8c9819554ab103aebd35fa93f0e63593b34/animal_hospitals_usa.csv",
        "stusps": selectedUsState.stusps,
        "data_description": "test data"
      })
    })
    .then((res) => {
      res.json()
        .then(geojson => {
          setgeoJSON(geojson)
          
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
        .catch(error => console.log('error', error))
    })
    .catch(error => console.log('error', error))

  }

  const usStateChange = (stateAbbrev) => {
    const stateMatch = usStates.find((usState) => usState.stusps === stateAbbrev)
    setSelectedUsState(stateMatch)
  }

  const csvUrlChange = event => setCsvUrl(event.target.value)

  const override = `
    display: block;
    margin: .75rem auto;
    width: 180px;
  `
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
              sample
          </button>
        </div>
        <div className="ui-row">
          <button onClick={(event) => { makeQuery(event) }}>Query!</button>
        </div>
        { loading ? <div className="ui-row"><BarLoader color={barColor} loading={loading} css={override} /></div> : null }
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