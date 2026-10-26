'use client';

import React, { useEffect } from 'react';
import { MapContainer, TileLayer, Marker, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

export interface LatLng { lat: number; lng: number }

// A plain CSS pin, so we don't depend on Leaflet's bundled marker images.
const pin = L.divIcon({
  className: '',
  html: '<div style="width:22px;height:22px;border-radius:50% 50% 50% 0;background:#4338ca;border:3px solid #fff;transform:rotate(-45deg);box-shadow:0 1px 4px rgba(0,0,0,.4)"></div>',
  iconSize: [22, 22],
  iconAnchor: [11, 22],
});

const INDIA_CENTER: LatLng = { lat: 22.5, lng: 79 };

function ClickToPlace({ onChange }: { onChange: (p: LatLng) => void }) {
  useMapEvents({ click: (e) => onChange({ lat: e.latlng.lat, lng: e.latlng.lng }) });
  return null;
}

function FlyTo({ value }: { value: LatLng | null }) {
  const map = useMap();
  useEffect(() => {
    if (value) map.flyTo([value.lat, value.lng], Math.max(map.getZoom(), 17), { duration: 0.6 });
  }, [value, map]);
  return null;
}

/** Click the map or drag the pin to set the issue location. */
export default function LocationPicker({ value, onChange }: { value: LatLng | null; onChange: (p: LatLng) => void }) {
  return (
    <MapContainer
      center={value ? [value.lat, value.lng] : [INDIA_CENTER.lat, INDIA_CENTER.lng]}
      zoom={value ? 17 : 5}
      className="h-72 w-full rounded-lg border border-gray-300 z-0"
      scrollWheelZoom={false}
    >
      <TileLayer attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
      <ClickToPlace onChange={onChange} />
      <FlyTo value={value} />
      {value && (
        <Marker
          position={[value.lat, value.lng]}
          icon={pin}
          draggable
          eventHandlers={{ dragend: (e) => { const p = (e.target as L.Marker).getLatLng(); onChange({ lat: p.lat, lng: p.lng }); } }}
        />
      )}
    </MapContainer>
  );
}
