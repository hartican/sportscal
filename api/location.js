"use strict";

const FALLBACK_LOCATIONS = Object.freeze([
  ["sydney", { label:"Sydney", region:"NSW", countryCode:"AU", latitude:-33.87, longitude:151.21 }],
  ["2000", { label:"Sydney", region:"NSW", countryCode:"AU", latitude:-33.87, longitude:151.21 }],
  ["melbourne", { label:"Melbourne", region:"VIC", countryCode:"AU", latitude:-37.81, longitude:144.96 }],
  ["3000", { label:"Melbourne", region:"VIC", countryCode:"AU", latitude:-37.81, longitude:144.96 }],
  ["brisbane", { label:"Brisbane", region:"QLD", countryCode:"AU", latitude:-27.47, longitude:153.03 }],
  ["4000", { label:"Brisbane", region:"QLD", countryCode:"AU", latitude:-27.47, longitude:153.03 }],
  ["perth", { label:"Perth", region:"WA", countryCode:"AU", latitude:-31.95, longitude:115.86 }],
  ["6000", { label:"Perth", region:"WA", countryCode:"AU", latitude:-31.95, longitude:115.86 }],
  ["adelaide", { label:"Adelaide", region:"SA", countryCode:"AU", latitude:-34.93, longitude:138.60 }],
  ["5000", { label:"Adelaide", region:"SA", countryCode:"AU", latitude:-34.93, longitude:138.60 }],
  ["canberra", { label:"Canberra", region:"ACT", countryCode:"AU", latitude:-35.28, longitude:149.13 }],
  ["2600", { label:"Canberra", region:"ACT", countryCode:"AU", latitude:-35.28, longitude:149.13 }],
  ["leeds", { label:"Leeds", region:"England", countryCode:"GB", latitude:53.80, longitude:-1.55 }],
]);

function requestUrl(request){
  return new URL(request?.url || "/api/location", "https://nothingsport.vercel.app");
}

function roundedLocation(input, source){
  return {
    label:String(input.label || "Current area").slice(0, 120),
    region:String(input.region || "").slice(0, 80),
    countryCode:String(input.countryCode || "AU").toUpperCase().slice(0, 2),
    latitude:Number(Number(input.latitude).toFixed(2)),
    longitude:Number(Number(input.longitude).toFixed(2)),
    radiusKm:20,
    mode:"home",
    source,
    updatedAt:new Date().toISOString(),
  };
}

function componentsMap(components){
  const result = {};
  (components || []).forEach(component => (component.types || []).forEach(type => { result[type] ||= component; }));
  return result;
}

async function googleTextSearch(query, key){
  const response = await fetch("https://places.googleapis.com/v1/places:searchText", {
    method:"POST",
    headers:{
      "Content-Type":"application/json",
      "X-Goog-Api-Key":key,
      "X-Goog-FieldMask":"places.displayName,places.formattedAddress,places.location,places.addressComponents",
    },
    body:JSON.stringify({ textQuery:query, maxResultCount:1 }),
  });
  if (!response.ok) throw new Error("Google Places could not resolve that area.");
  const place = (await response.json()).places?.[0];
  if (!place?.location) return null;
  const parts = componentsMap(place.addressComponents);
  return roundedLocation({
    label:parts.locality?.longText || parts.postal_town?.longText || place.displayName?.text || place.formattedAddress,
    region:parts.administrative_area_level_1?.shortText || parts.administrative_area_level_1?.longText || "",
    countryCode:parts.country?.shortText || "AU",
    latitude:place.location.latitude,
    longitude:place.location.longitude,
  }, "places");
}

async function googleReverse(latitude, longitude, key){
  const url = new URL("https://maps.googleapis.com/maps/api/geocode/json");
  url.searchParams.set("latlng", `${latitude},${longitude}`);
  url.searchParams.set("key", key);
  const response = await fetch(url);
  if (!response.ok) return null;
  const result = (await response.json()).results?.[0];
  if (!result) return null;
  const parts = componentsMap(result.address_components?.map(component => ({ longText:component.long_name, shortText:component.short_name, types:component.types })));
  return roundedLocation({
    label:parts.locality?.longText || parts.postal_town?.longText || parts.administrative_area_level_2?.longText || "Current area",
    region:parts.administrative_area_level_1?.shortText || "",
    countryCode:parts.country?.shortText || "AU",
    latitude,
    longitude,
  }, "system");
}

async function openMeteoSearch(query){
  const url = new URL("https://geocoding-api.open-meteo.com/v1/search");
  url.searchParams.set("name", query);
  url.searchParams.set("count", "1");
  url.searchParams.set("language", "en");
  url.searchParams.set("format", "json");
  const response = await fetch(url, { headers:{ Accept:"application/json" } });
  if (!response.ok) return null;
  const place = (await response.json()).results?.[0];
  if (!place || !Number.isFinite(Number(place.latitude)) || !Number.isFinite(Number(place.longitude))) return null;
  return roundedLocation({
    label:place.name || query,
    region:place.admin1 || "",
    countryCode:place.country_code || "AU",
    latitude:place.latitude,
    longitude:place.longitude,
  }, "manual");
}

module.exports = async function locationHandler(request, response){
  response.setHeader("Cache-Control", "private, max-age=300");
  if ((request.method || "GET") !== "GET"){
    response.setHeader("Allow", "GET");
    response.status(405).json({ error:"Location search supports GET only." });
    return;
  }
  try{
    const url = requestUrl(request);
    const query = String(url.searchParams.get("q") || "").trim().slice(0, 120);
    const latitudeValue = url.searchParams.get("lat");
    const longitudeValue = url.searchParams.get("lng");
    const latitude = latitudeValue === null ? Number.NaN : Number(latitudeValue);
    const longitude = longitudeValue === null ? Number.NaN : Number(longitudeValue);
    const key = String(process.env.GOOGLE_MAPS_API_KEY || "").trim();
    let location = null;
    if (Number.isFinite(latitude) && Number.isFinite(longitude) && Math.abs(latitude) <= 90 && Math.abs(longitude) <= 180){
      location = key ? await googleReverse(latitude, longitude, key) : roundedLocation({ label:"Current area", latitude, longitude }, "system");
    } else if (query){
      location = key ? await googleTextSearch(query, key) : null;
      if (!location){
        const normalized = query.toLowerCase();
        const fallback = FALLBACK_LOCATIONS.find(([name]) => normalized === name || normalized.includes(name))?.[1];
        if (fallback) location = roundedLocation(fallback, "manual");
      }
      if (!location) location = await openMeteoSearch(query);
    }
    if (!location){
      response.status(404).json({ error:"That city, postcode or area could not be found." });
      return;
    }
    response.status(200).json({ location });
  }catch(_error){
    response.status(502).json({ error:"Location lookup is temporarily unavailable." });
  }
};
