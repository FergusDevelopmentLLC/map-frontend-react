import React, { useEffect, useRef, useState } from "react"
import mapboxgl from "mapbox-gl"
import "mapbox-gl/dist/mapbox-gl.css"

const Map = ({
  center = [-96.410, 41.399],
  zoom = 3
}) => {

  const mapContainer = useRef(null)
  const [statefulMap, setMap] = useState(null)
  const [states, setStates] = useState([])
  const [geoJSON, setgeoJSON] = useState(null)

  useEffect(() => {

    const initializeMap = () => {

      mapboxgl.accessToken = 'pk.eyJ1Ijoid2lsbGNhcnRlciIsImEiOiJjamV4b2g3Z2ExOGF4MzFwN3R1dHJ3d2J4In0.Ti-hnuBH8W4bHn7k6GCpGw'
            
      const mapboxGlMap = new mapboxgl.Map({
        container: mapContainer.current,
        style: `mapbox://styles/mapbox/light-v10`,
        center: center,
        zoom: zoom,
        attributionControl: false
      })

      mapboxGlMap.on("load", () => {
        console.log('map load')
      })

      setMap(mapboxGlMap)
    }

    console.log('statefulMap', statefulMap)

    if (!statefulMap) {
      initializeMap()
    }
    else {
      if(geoJSON) {
        
        statefulMap.addSource('aoi', {
          type: 'geojson',
          data: geoJSON
        })

        statefulMap.addLayer({
          id: 'aoi-layer',
          source: 'aoi',
          type: 'fill'
        })
      }
    }

  }, [statefulMap, center, zoom, geoJSON])

  useEffect(() => {

    fetch("https://8450cseuue.execute-api.us-east-1.amazonaws.com/production/states")
      .then((res) => {
        res.json()
          .then(states => setStates(states))
          .catch(error => console.log('error', error))
      })
      .catch(error => console.log('error', error))

    }, [])
  
  const stateChange = (event) => {
    console.log('event.target.value', event.target.value)

    fetch("https://8450cseuue.execute-api.us-east-1.amazonaws.com/production/getGeoJsonForCsv",{
      method: 'POST',
      body: JSON.stringify({
        "csvUrl": "https://gist.githubusercontent.com/FergusDevelopmentLLC/b95090d5c494ced48a1610c3e954a382/raw/1ef9f8c9819554ab103aebd35fa93f0e63593b34/animal_hospitals_usa.csv",
        "stusps": event.target.value,
        "data_description": "test data"
      })
    })
      .then((res) => {
        res.json()
          .then(geojson => {
            setgeoJSON(geojson)
          })
          .catch(error => console.log('error', error))
      })
      .catch(error => console.log('error', error))
  }

  return (
    <div ref={mapContainer} className="map-container">
      <div className="dropdown-container">
        <select onChange={(event) => { stateChange(event) }} >
          <option>-Select state-</option>
          {
            states.map((state, i)=> {
              return <option key={i} value={ state.stusps }>{ state.name }</option>
            })
          }
        </select>
      </div>
    </div>
  )
}

export default Map