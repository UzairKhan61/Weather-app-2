const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];

let state = { lat: 31.5204, lon: 74.3587, city: "Lahore", country: "Pakistan", unit: "C", data: null };

const weatherCodes = {
  0:["Clear sky","☀️","clear"],1:["Mainly clear","🌤️","clear"],2:["Partly cloudy","⛅","cloudy"],3:["Overcast","☁️","cloudy"],
  45:["Fog","🌫️","fog"],48:["Rime fog","🌫️","fog"],51:["Light drizzle","🌦️","rain"],53:["Drizzle","🌦️","rain"],55:["Heavy drizzle","🌧️","rain"],
  61:["Light rain","🌦️","rain"],63:["Rain","🌧️","rain"],65:["Heavy rain","🌧️","rain"],71:["Light snow","🌨️","snow"],73:["Snow","❄️","snow"],75:["Heavy snow","❄️","snow"],
  80:["Rain showers","🌦️","rain"],81:["Rain showers","🌧️","rain"],82:["Heavy showers","⛈️","rain"],95:["Thunderstorm","⛈️","storm"],96:["Thunderstorm + hail","⛈️","storm"],99:["Thunderstorm + hail","⛈️","storm"]
};

function weatherInfo(code){ return weatherCodes[code] || ["Unknown","🌤️","clear"]; }
function cToF(c){return c*9/5+32}
function temp(v){return Math.round(state.unit==="C"?v:cToF(v))}
function tempText(v){return `${temp(v)}°`}
function direction(deg){
  const dirs=["N","NE","E","SE","S","SW","W","NW"];
  return dirs[Math.round(deg/45)%8];
}
function uvText(v){return v<3?"Low":v<6?"Moderate":v<8?"High":"Very high"}

function showToast(msg){
  const t=$("#toast"); t.textContent=msg; t.classList.add("show");
  setTimeout(()=>t.classList.remove("show"),3200);
}

async function geocode(city){
  const url=`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&count=1&language=en&format=json`;
  const res=await fetch(url);
  if(!res.ok) throw new Error("Location search failed");
  const data=await res.json();
  if(!data.results?.length) throw new Error("City not found. Try another city.");
  const p=data.results[0];
  return {lat:p.latitude,lon:p.longitude,city:p.name,country:p.country};
}

async function getWeather(){
  const url=`https://api.open-meteo.com/v1/forecast?latitude=${state.lat}&longitude=${state.lon}&current=temperature_2m,relative_humidity_2m,apparent_temperature,is_day,precipitation,weather_code,surface_pressure,wind_speed_10m,wind_direction_10m&hourly=visibility&daily=weather_code,temperature_2m_max,temperature_2m_min,uv_index_max&timezone=auto&forecast_days=7`;
  const res=await fetch(url);
  if(!res.ok) throw new Error("Weather service unavailable");
  state.data=await res.json();
  render();
}

function render(){
  const d=state.data, c=d.current, info=weatherInfo(c.weather_code);
  $("#currentCity").textContent=`${state.city}, ${state.country}`;
  $("#updated").textContent=`Updated ${new Date().toLocaleTimeString([], {hour:"2-digit",minute:"2-digit"})}`;
  $("#temperature").textContent=temp(c.temperature_2m);
  $("#condition").textContent=info[0];
  $("#high").textContent=tempText(d.daily.temperature_2m_max[0]);
  $("#low").textContent=tempText(d.daily.temperature_2m_min[0]);
  $("#humidity").textContent=`${c.relative_humidity_2m}%`;
  $("#wind").textContent=`${Math.round(c.wind_speed_10m)} km/h`;
  $("#windDir").textContent=`Direction ${direction(c.wind_direction_10m)}`;
  $("#uv").textContent=Math.round(d.daily.uv_index_max[0]*10)/10;
  $("#uvText").textContent=uvText(d.daily.uv_index_max[0]);
  $("#visibility").textContent=`${Math.round((d.hourly.visibility[0]||0)/100)/10} km`;
  $("#miniWind").textContent=`${Math.round(c.wind_speed_10m)} km/h`;
  $("#miniHumidity").textContent=`${c.relative_humidity_2m}%`;
  $("#miniFeels").textContent=tempText(c.apparent_temperature);
  $("#weatherCharacter").textContent=info[1];
  applyAnimation(info[2]);
  renderForecast();
  updateTip(info[2], c.temperature_2m, d.daily.uv_index_max[0]);
}

function applyAnimation(type){
  const scene=$("#cartoonScene"), rain=$$(".rain",scene);
  scene.classList.remove("is-rain","is-storm");
  rain.forEach(x=>x.style.display="none");
  if(type==="rain"||type==="storm"){
    scene.classList.add(type==="storm"?"is-storm":"is-rain");
    rain.forEach(x=>x.style.display="block");
  }
  if(type==="snow") $("#weatherCharacter").textContent="☃️";
}

function renderForecast(){
  const d=state.data.daily, grid=$("#forecastGrid");
  grid.innerHTML=d.time.map((date,i)=>{
    const info=weatherInfo(d.weather_code[i]);
    const day=i===0?"Today":new Date(date+"T12:00:00").toLocaleDateString("en-US",{weekday:"short"});
    return `<article class="forecast-card ${i===0?"today":""}">
      <div class="day">${day}</div><div class="forecast-icon">${info[1]}</div>
      <div class="forecast-temp">${temp(d.temperature_2m_max[i])}° <small>${temp(d.temperature_2m_min[i])}°</small></div>
      <small>${info[0]}</small>
    </article>`;
  }).join("");
}

function updateTip(type,t,uv){
  const tips={
    clear:["Sunny day!","Wear sunscreen, drink enough water and consider sunglasses if you're spending time outdoors."],
    cloudy:["Cloudy but comfortable!","A light layer can be useful. Keep an eye on the forecast if clouds are building."],
    rain:["Rainy-day ready!","Take an umbrella or rain jacket and allow extra travel time on wet roads."],
    storm:["Storm alert!","Stay indoors when thunderstorms are nearby and avoid exposed outdoor areas."],
    snow:["Bundle up!","Wear warm layers and keep an eye on road conditions if snow is expected."]
  };
  let x=tips[type]||tips.clear;
  if(uv>=6) x=["UV is high today!","Use sunscreen, seek shade around midday and protect your eyes when outdoors."];
  if(t<5) x=["Cold weather today!","Dress in warm layers and protect exposed skin from the cold."];
  $("#tipTitle").textContent=x[0]; $("#tipText").textContent=x[1];
}

async function searchCity(city){
  try{
    showToast("Finding live weather...");
    const place=await geocode(city);
    state={...state,...place};
    await getWeather();
    showToast(`Live weather loaded for ${state.city}.`);
  }catch(e){showToast(e.message)}
}

$("#searchForm").addEventListener("submit",e=>{
  e.preventDefault();
  const city=$("#cityInput").value.trim();
  if(city) searchCity(city);
});

$("#refreshBtn").addEventListener("click",()=>getWeather().then(()=>showToast("Weather refreshed.")).catch(e=>showToast(e.message)));

$("#locationBtn").addEventListener("click",()=>{
  if(!navigator.geolocation){showToast("Geolocation is not supported by this browser.");return}
  showToast("Getting your location...");
  navigator.geolocation.getCurrentPosition(async p=>{
    try{
      state.lat=p.coords.latitude; state.lon=p.coords.longitude; state.city="Your location"; state.country="";
      await getWeather(); showToast("Live weather loaded for your location.");
    }catch(e){showToast(e.message)}
  },()=>showToast("Location permission was denied."));
});

$("#unitToggle").addEventListener("click",()=>{
  state.unit=state.unit==="C"?"F":"C";
  $("#unitToggle").textContent=state.unit==="C"?"°C / °F":"°F / °C";
  if(state.data) render();
});

$("#menuBtn").addEventListener("click",()=>$(".nav-wrap nav").classList.toggle("open"));
$$(".nav-wrap nav a").forEach(a=>a.addEventListener("click",()=>$(".nav-wrap nav").classList.remove("open")));

getWeather().catch(e=>{
  showToast("Could not load weather. Check your internet connection.");
  $("#updated").textContent="Unable to connect";
});
