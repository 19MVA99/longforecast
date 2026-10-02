import { useState, useEffect } from 'react'
import './App.css'

// Превращает код погоды в текст и эмодзи
function getWeatherDescription(code) {
  if (code === 0) return { text: 'Ясно', emoji: '☀️' }
  if (code <= 3) return { text: 'Облачно', emoji: '⛅' }
  if (code <= 48) return { text: 'Туман', emoji: '🌫️' }
  if (code <= 57) return { text: 'Морось', emoji: '🌦️' }
  if (code <= 67) return { text: 'Дождь', emoji: '🌧️' }
  if (code <= 77) return { text: 'Снег', emoji: '❄️' }
  if (code <= 82) return { text: 'Ливень', emoji: '🌧️' }
  if (code <= 86) return { text: 'Снегопад', emoji: '🌨️' }
  return { text: 'Гроза', emoji: '⛈️' }
}

// Форматирует дату в строку вида "14:35:07" в нужном часовом поясе
function formatTime(date, timezone) {
  try {
    return new Intl.DateTimeFormat('ru-RU', {
      timeZone: timezone,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    }).format(date)
  } catch {
    // Если часовой пояс некорректный — вернём локальное время
    return date.toLocaleTimeString('ru-RU')
  }
}

function App() {
  // Что введено в поле прямо сейчас (меняется на каждую букву)
  const [city, setCity] = useState('Минск')
  // Какой город искать (меняется только по кнопке/Enter)
  // type: 'city' — искать через геокодинг, 'coords' — сразу по координатам
  const [query, setQuery] = useState({ type: 'city', value: 'Минск' })

  const [weather, setWeather] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [geoLoading, setGeoLoading] = useState(false)

  // Текущее время для отображения (обновляется раз в секунду)
  const [now, setNow] = useState(new Date())

  // Загружаем погоду при загрузке и при каждом изменении query
  useEffect(() => {
    async function loadWeather() {
      setLoading(true)
      setError(null)

      try {
        let latitude, longitude, cityName, countryName

        if (query.type === 'coords') {
          // Прямой запрос по координатам (из геолокации)
          latitude = query.lat
          longitude = query.lon
          cityName = 'Моё местоположение'
          countryName = ''
        } else {
          // 1. Получаем координаты по названию города
          const geoUrl = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(query.value)}&count=1&language=ru`
          const geoResponse = await fetch(geoUrl)
          const geoData = await geoResponse.json()

          if (!geoData.results || geoData.results.length === 0) {
            setError('Город не найден')
            setLoading(false)
            return
          }

          latitude = geoData.results[0].latitude
          longitude = geoData.results[0].longitude
          cityName = geoData.results[0].name
          countryName = geoData.results[0].country
        }

        // 2. Получаем погоду по координатам
        const weatherUrl = `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,weather_code,wind_speed_10m&timezone=auto`
        const weatherResponse = await fetch(weatherUrl)
        const weatherData = await weatherResponse.json()

        weatherData.cityName = cityName
        weatherData.countryName = countryName

        setWeather(weatherData)
        setLoading(false)
      } catch (err) {
        setError('Ошибка сети. Попробуйте ещё раз.')
        setLoading(false)
      }
    }

    loadWeather()
  }, [query])

  // Обновляем время каждую секунду
  useEffect(() => {
    const timer = setInterval(() => {
      setNow(new Date())
    }, 1000)

    // Убираем таймер, когда компонент "умирает" — иначе утечка памяти
    return () => clearInterval(timer)
  }, [])

  // Поиск по названию города
  function handleSubmit(e) {
    e.preventDefault()
    if (city.trim() === '') return
    setQuery({ type: 'city', value: city.trim() })
  }

  // Кнопка "Моё местоположение"
  function handleGeolocation() {
    if (!navigator.geolocation) {
      setError('Геолокация не поддерживается браузером')
      return
    }

    setGeoLoading(true)
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setGeoLoading(false)
        setQuery({
          type: 'coords',
          lat: position.coords.latitude,
          lon: position.coords.longitude,
        })
      },
      (err) => {
        setGeoLoading(false)
        if (err.code === 1) setError('Доступ к геолокации запрещён')
        else setError('Не удалось определить местоположение')
      }
    )
  }

  const description = weather ? getWeatherDescription(weather.current.weather_code) : null

  return (
    <div className="app">
      <h1>LF⛅</h1>

      <form className="search" onSubmit={handleSubmit}>
        <input
          type="text"
          value={city}
          onChange={(e) => setCity(e.target.value)}
          placeholder="Введите город"
          className="search-input"
        />
        <button type="submit" className="search-btn">Найти</button>
      </form>

      <button
        className="geo-btn"
        onClick={handleGeolocation}
        disabled={geoLoading}
      >
        {geoLoading ? '⏳ Определяем…' : '📍 Моё местоположение'}
      </button>

      {loading && <p className="status">Загрузка…</p>}
      {error && <p className="status error">{error}</p>}

      {!loading && !error && weather && (
        <div className="card">
          <p className="city">
            {weather.cityName}
            {weather.countryName && `, ${weather.countryName}`}
          </p>

          <p className="time">🕐 {formatTime(now, weather.timezone)}</p>

          <div className="emoji">{description.emoji}</div>
          <p className="temp">{weather.current.temperature_2m}°C</p>
          <p className="desc">{description.text}</p>
          <p className="wind">💨 Ветер: {weather.current.wind_speed_10m} км/ч</p>
        </div>
      )}

      <footer className="footer">
        <p>© {new Date().getFullYear()} LongForecast</p>
        <p className="footer-sub">Данные: Open-Meteo</p>
      </footer>
    </div>
  )
}

export default App