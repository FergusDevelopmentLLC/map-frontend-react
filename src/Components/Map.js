import React, { useEffect, useRef, useState } from "react"
import mapboxgl from "mapbox-gl"
import "mapbox-gl/dist/mapbox-gl.css"

const Map = ({
  center = [-96.410, 41.399],
  zoom = 3
}) => {

  const mapContainer = useRef(null)
  const [statefulMap, setMap] = useState(null)

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

  }, [statefulMap, center, zoom])

  return (
    <div ref={mapContainer} className="map-container"></div>
  )
}

export default Map