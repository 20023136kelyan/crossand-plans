'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Cloud,
  CloudRain,
  Sun,
  CloudSnow,
  Wind,
  Thermometer,
  Droplets,
  Eye,
  RefreshCw,
  AlertTriangle,
  Sunrise,
  Sunset,
  Gauge,
  MapPin,
  Calendar
} from 'lucide-react';
import type { Plan as PlanType, UserPreferences, Profile } from '@/types/user';

interface WeatherData {
  temperature: number;
  description: string;
  humidity: number;
  windSpeed: number;
  windDirection?: number;
  visibility: number;
  icon: string;
  feelsLike: number;
  uvIndex?: number;
  precipitation?: number;
  pressure: number;
  cloudCover: number;
  sunrise?: number;
  sunset?: number;
  location: {
    name: string;
    country: string;
  };
  timezone?: string;
}

interface ForecastDay {
  date: string;
  temperature: {
    min: number;
    max: number;
  };
  description: string;
  icon: string;
  humidity: number;
  windSpeed: number;
  precipitation: number;
}

interface WeatherResponse {
  current: WeatherData;
  forecast: ForecastDay[];
}

interface PlanWeatherProps {
  location: string;
  date: string;
  className?: string;
  apiKey?: string;
  showForecast?: boolean;
  coordinates?: {
    lat: number;
    lon: number;
  };
  userPreferences?: UserPreferences;
  participantProfiles?: Profile[];
  planType?: string;
}

export function PlanWeather({ 
  location, 
  date, 
  className, 
  apiKey, 
  showForecast = false,
  coordinates,
  userPreferences,
  participantProfiles,
  planType
}: PlanWeatherProps) {
  const [weatherData, setWeatherData] = useState<WeatherResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  
  // Use environment variable as fallback for API key
  const weatherApiKey = apiKey || process.env.NEXT_PUBLIC_OPENWEATHER_API_KEY;

  const getWeatherIcon = (iconCode: string, description: string) => {
    const desc = description.toLowerCase();
    const code = iconCode.substring(0, 2); // Remove day/night indicator
    
    // Enhanced icon mapping based on OpenWeather icon codes
    switch (code) {
      case '01': // clear sky
        return iconCode.includes('d') ? 
          <Sun className="h-8 w-8 text-yellow-500 drop-shadow-lg" /> : 
          <Sun className="h-8 w-8 text-yellow-300" />;
      case '02': // few clouds
      case '03': // scattered clouds
      case '04': // broken clouds
        return <Cloud className="h-8 w-8 text-gray-500" />;
      case '09': // shower rain
      case '10': // rain
        return <CloudRain className="h-8 w-8 text-blue-500" />;
      case '11': // thunderstorm
        return <CloudRain className="h-8 w-8 text-purple-600" />;
      case '13': // snow
        return <CloudSnow className="h-8 w-8 text-blue-200" />;
      case '50': // mist
        return <Cloud className="h-8 w-8 text-gray-400" />;
      default:
        // Fallback based on description
        if (desc.includes('rain') || desc.includes('drizzle')) {
          return <CloudRain className="h-8 w-8 text-blue-500" />;
        } else if (desc.includes('snow')) {
          return <CloudSnow className="h-8 w-8 text-blue-200" />;
        } else if (desc.includes('cloud')) {
          return <Cloud className="h-8 w-8 text-gray-500" />;
        } else {
          return <Sun className="h-8 w-8 text-yellow-500" />;
        }
    }
  };

  const getWindDirection = (degrees: number) => {
    const directions = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
    return directions[Math.round(degrees / 22.5) % 16];
  };

  const formatTime = (timestamp: number) => {
    return new Date(timestamp * 1000).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });
  };

  const geocodeLocation = async (locationName: string) => {
    if (!weatherApiKey) return undefined;
    
    // Create fallback location queries from most specific to least specific
    const locationQueries = [locationName];
    
    // If it's a detailed address, create fallback queries
    if (locationName.includes(',')) {
      const parts = locationName.split(',').map(part => part.trim());
      
      // Try city, state, country combinations
      if (parts.length >= 3) {
        // Try "City, State, Country"
        locationQueries.push(`${parts[parts.length - 3]}, ${parts[parts.length - 2]}, ${parts[parts.length - 1]}`);
        // Try "City, State"
        locationQueries.push(`${parts[parts.length - 3]}, ${parts[parts.length - 2]}`);
        // Try just the city
        locationQueries.push(parts[parts.length - 3]);
      } else if (parts.length >= 2) {
        // Try "City, Country" or "City, State"
        locationQueries.push(`${parts[0]}, ${parts[parts.length - 1]}`);
        // Try just the first part (likely city)
        locationQueries.push(parts[0]);
      }
    }
    
    // Try each query until one succeeds
    for (const query of locationQueries) {
      try {
        console.log(`Trying geocoding query: "${query}"`);
        const response = await fetch(
          `https://api.openweathermap.org/geo/1.0/direct?q=${encodeURIComponent(query)}&limit=1&appid=${weatherApiKey}`
        );
        
        if (response.ok) {
          const data = await response.json();
          if (data.length > 0) {
            console.log(`Geocoding successful for query: "${query}"`, data[0]);
            return { lat: data[0].lat, lon: data[0].lon };
          }
        } else {
          console.log(`Geocoding failed for query: "${query}" - ${response.status}`);
        }
      } catch (error) {
        console.log(`Geocoding error for query: "${query}"`, error);
        continue;
      }
    }
    
    console.error('All geocoding attempts failed for location:', locationName);
    return undefined;
  };

  const fetchWeather = async () => {
    if (!location || !date) {
      setError('Location and date are required');
      return;
    }

    if (!weatherApiKey) {
      setError('Weather API key not configured. Please add NEXT_PUBLIC_OPENWEATHER_API_KEY to your environment variables.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Get coordinates for the location
      let coords = coordinates;
      if (!coords) {
        coords = await geocodeLocation(location);
        if (!coords) {
          throw new Error('Unable to find coordinates for the specified location');
        }
      }

      const planDate = new Date(date);
      const now = new Date();
      const timeDiffHours = (planDate.getTime() - now.getTime()) / (1000 * 60 * 60);

      let weatherForPlan: WeatherData | null = null;

      // If plan is within 5 days, use forecast data to get weather for specific time
      if (timeDiffHours > 0 && timeDiffHours <= 120) { // 5 days = 120 hours
        const forecastResponse = await fetch(
          `https://api.openweathermap.org/data/2.5/forecast?lat=${coords.lat}&lon=${coords.lon}&appid=${weatherApiKey}&units=metric`
        );

        if (forecastResponse.ok) {
          const forecastData = await forecastResponse.json();
          
          // Find the forecast entry closest to the plan time
          const planTimestamp = Math.floor(planDate.getTime() / 1000);
          let closestForecast: any = null;
          let minTimeDiff = Infinity;

          forecastData.list.forEach((item: any) => {
            const timeDiff = Math.abs(item.dt - planTimestamp);
            if (timeDiff < minTimeDiff) {
              minTimeDiff = timeDiff;
              closestForecast = item;
            }
          });

          if (closestForecast) {
            weatherForPlan = {
              temperature: Math.round(closestForecast.main.temp),
              description: closestForecast.weather[0].description,
              humidity: closestForecast.main.humidity,
              windSpeed: Math.round(closestForecast.wind.speed * 3.6),
              windDirection: closestForecast.wind.deg,
              visibility: closestForecast.visibility ? Math.round(closestForecast.visibility / 1000) : 10,
              icon: closestForecast.weather[0].icon,
              feelsLike: Math.round(closestForecast.main.feels_like),
              pressure: closestForecast.main.pressure,
              cloudCover: closestForecast.clouds.all,
              precipitation: closestForecast.rain ? closestForecast.rain['3h'] || 0 : 0,
              uvIndex: undefined, // Will be set later if UV data is available
              location: {
                name: forecastData.city.name,
                country: forecastData.city.country
              }
            };
          }
        }
      }

      // If no forecast data available or plan is too far in future, use current weather
      if (!weatherForPlan) {
        const currentWeatherResponse = await fetch(
          `https://api.openweathermap.org/data/2.5/weather?lat=${coords.lat}&lon=${coords.lon}&appid=${weatherApiKey}&units=metric`
        );

        if (!currentWeatherResponse.ok) {
          throw new Error(`Weather API error: ${currentWeatherResponse.status}`);
        }

        const currentWeatherData: any = await currentWeatherResponse.json();
        
        weatherForPlan = {
          temperature: Math.round(currentWeatherData.main.temp),
          description: currentWeatherData.weather[0].description,
          humidity: currentWeatherData.main.humidity,
          windSpeed: Math.round(currentWeatherData.wind.speed * 3.6),
          windDirection: currentWeatherData.wind.deg,
          visibility: currentWeatherData.visibility ? Math.round(currentWeatherData.visibility / 1000) : 10,
          icon: currentWeatherData.weather[0].icon,
          feelsLike: Math.round(currentWeatherData.main.feels_like),
          pressure: currentWeatherData.main.pressure,
          cloudCover: currentWeatherData.clouds.all,
          sunrise: currentWeatherData.sys.sunrise,
          sunset: currentWeatherData.sys.sunset,
          uvIndex: undefined, // Will be set later if UV data is available
          location: {
            name: currentWeatherData.name,
            country: currentWeatherData.sys.country
          },
          timezone: currentWeatherData.timezone?.toString()
        };
      }

      // Try to fetch UV Index data
      try {
        const uvResponse = await fetch(
          `https://api.openweathermap.org/data/2.5/uvi?lat=${coords.lat}&lon=${coords.lon}&appid=${weatherApiKey}`
        );
        if (uvResponse.ok) {
          const uvData: any = await uvResponse.json();
          if (weatherForPlan) {
            weatherForPlan.uvIndex = Math.round(uvData.value);
          }
        }
      } catch (uvError) {
        console.log('UV Index data not available:', uvError);
      }

      const transformedWeatherData: WeatherResponse = {
        current: weatherForPlan,
        forecast: [] // We don't need forecast for plan-specific weather
      };

      setWeatherData(transformedWeatherData);
      setRetryCount(0);
    } catch (err) {
      console.error('Weather fetch error:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch weather data');
      
      if (retryCount < 2 && err instanceof Error && err.message.includes('API error')) {
        setTimeout(() => {
          setRetryCount(prev => prev + 1);
          fetchWeather();
        }, 2000 * (retryCount + 1));
      }
    } finally {
      setLoading(false);
    }
  };

  const transformForecastData = (forecastData: any): ForecastDay[] => {
    // Group forecast data by day and take one entry per day
    const dailyForecasts: { [key: string]: any } = {};
    
    forecastData.list.forEach((item: any) => {
      const date = new Date(item.dt * 1000).toDateString();
      if (!dailyForecasts[date]) {
        dailyForecasts[date] = {
          date: new Date(item.dt * 1000).toLocaleDateString('en-US', {
            weekday: 'short',
            month: 'short',
            day: 'numeric'
          }),
          temperature: {
            min: item.main.temp,
            max: item.main.temp
          },
          description: item.weather[0].description,
          icon: item.weather[0].icon,
          humidity: item.main.humidity,
          windSpeed: Math.round(item.wind.speed * 3.6),
          precipitation: item.rain ? item.rain['3h'] || 0 : 0
        };
      } else {
        // Update min/max temperatures
        dailyForecasts[date].temperature.min = Math.min(
          dailyForecasts[date].temperature.min,
          item.main.temp
        );
        dailyForecasts[date].temperature.max = Math.max(
          dailyForecasts[date].temperature.max,
          item.main.temp
        );
      }
    });

    return Object.values(dailyForecasts)
      .slice(0, 5) // Take first 5 days
      .map((day: any) => ({
        ...day,
        temperature: {
          min: Math.round(day.temperature.min),
          max: Math.round(day.temperature.max)
        }
      }));
  };

  useEffect(() => {
    fetchWeather();
  }, [location, date, weatherApiKey, coordinates, userPreferences, participantProfiles, planType]);

  // Memoized loading skeleton component
  const LoadingSkeleton = () => (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Skeleton className="h-16 w-16 rounded-full" />
          <div className="space-y-2">
            <Skeleton className="h-8 w-20" />
            <Skeleton className="h-4 w-24" />
          </div>
        </div>
        <div className="space-y-2 text-right">
          <Skeleton className="h-6 w-32" />
          <Skeleton className="h-4 w-24" />
        </div>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <Card key={i} className="bg-background/50 border-border/50">
            <CardContent className="p-3 text-center">
              <Skeleton className="h-5 w-5 mx-auto mb-2" />
              <Skeleton className="h-4 w-12 mx-auto mb-1" />
              <Skeleton className="h-3 w-16 mx-auto" />
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );

  const formatDate = (dateString: string) => {
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });
    } catch {
      return dateString;
    }
  };

  const getUVIndexColor = (uvIndex: number) => {
    if (uvIndex <= 2) return 'bg-primary/60';
    if (uvIndex <= 5) return 'bg-primary/70';
    if (uvIndex <= 7) return 'bg-primary/80';
    if (uvIndex <= 10) return 'bg-primary/90';
    return 'bg-primary';
  };

  const getUVIndexLabel = (uvIndex: number) => {
    if (uvIndex <= 2) return 'Low';
    if (uvIndex <= 5) return 'Moderate';
    if (uvIndex <= 7) return 'High';
    if (uvIndex <= 10) return 'Very High';
    return 'Extreme';
  };

  const generatePersonalizedRecommendations = (weather: WeatherData) => {
    const recommendations: string[] = [];
    const planDate = new Date(date);
    const planHour = planDate.getHours();
    const isOutdoorActivity = planType && ['outdoor', 'hiking', 'beach', 'park', 'sports', 'festival'].some(type => 
      planType.toLowerCase().includes(type)
    );

    // Temperature-based recommendations
    if (weather.temperature > 30) {
      recommendations.push('Very hot weather - bring plenty of water and seek shade frequently');
      if (isOutdoorActivity) {
        recommendations.push('Consider rescheduling outdoor activities to cooler hours');
      }
    } else if (weather.temperature > 25) {
      recommendations.push('Warm weather - wear light, breathable clothing and stay hydrated');
      if (isOutdoorActivity) {
        recommendations.push('Perfect weather for outdoor activities!');
      }
    } else if (weather.temperature < 5) {
      recommendations.push('Very cold weather - dress in warm layers and protect extremities');
      if (isOutdoorActivity) {
        recommendations.push('Consider indoor alternatives or ensure proper winter gear');
      }
    } else if (weather.temperature < 15) {
      recommendations.push('Cool weather - bring a jacket or sweater');
    }

    // Weather condition recommendations
    if (weather.description.toLowerCase().includes('rain')) {
      recommendations.push('Rain expected - bring umbrella or rain jacket');
      if (isOutdoorActivity) {
        recommendations.push('Have indoor backup plans ready');
      }
    }

    if (weather.description.toLowerCase().includes('snow')) {
      recommendations.push('Snow expected - wear appropriate footwear and drive carefully');
    }

    // Wind recommendations
    if (weather.windSpeed > 25) {
      recommendations.push('Very windy conditions - secure loose items and be cautious outdoors');
    } else if (weather.windSpeed > 15) {
      recommendations.push('Windy conditions - dress appropriately and secure belongings');
    }

    // UV recommendations
    if (weather.uvIndex && weather.uvIndex > 6) {
      recommendations.push('High UV levels - wear sunscreen (SPF 30+), sunglasses, and protective clothing');
    }

    // Humidity recommendations
    if (weather.humidity > 80) {
      recommendations.push('High humidity - stay hydrated and take frequent breaks');
    }

    // Time-based recommendations
    if (planHour >= 11 && planHour <= 15 && weather.temperature > 20) {
      recommendations.push('Peak sun hours - seek shade when possible');
    }

    // Visibility recommendations
    if (weather.visibility < 5) {
      recommendations.push('Reduced visibility - drive carefully and allow extra travel time');
    }

    // User preference-based recommendations
    if (userPreferences?.preferredCategories) {
      const outdoorCategories = ['outdoor', 'sports', 'adventure', 'nature'];
      const hasOutdoorPreference = userPreferences.preferredCategories.some(cat => 
        outdoorCategories.some(outdoor => cat.toLowerCase().includes(outdoor))
      );
      
      if (hasOutdoorPreference && weather.temperature > 15 && weather.temperature < 28 && !weather.description.includes('rain')) {
        recommendations.push('Great weather for your preferred outdoor activities!');
      }
    }

    // Group size considerations from participant profiles
    if (participantProfiles && participantProfiles.length > 0) {
      const groupSize = participantProfiles.length + 1; // +1 for host
      
      if (groupSize > 5 && weather.description.includes('rain')) {
        recommendations.push(`Large group (${groupSize} people) - coordinate indoor meeting points in case of rain`);
      }
      
      if (groupSize > 3 && weather.temperature < 10) {
        recommendations.push(`Cold weather for ${groupSize} people - ensure everyone has warm clothing`);
      }
    }

    return recommendations;
  };

  if (!date) {
      return null;
    }

  return (
    <Card className={`bg-gradient-to-br from-background/95 to-background/80 backdrop-blur-md border border-border/40 shadow-lg ${className || ''}`}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-lg font-semibold flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-primary/10">
            <Cloud className="h-4 w-4 text-primary" />
          </div>
          Weather
        </CardTitle>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={fetchWeather}
            disabled={loading}
            className="h-7 w-7 p-0 hover:bg-primary/10"
          >
            <RefreshCw className={`h-3 w-3 ${loading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {loading && <LoadingSkeleton />}

        {error && (
          <div className="flex flex-col items-center justify-center py-12 space-y-4">
            <div className="p-4 rounded-full bg-destructive/10">
              <AlertTriangle className="h-8 w-8 text-destructive" />
            </div>
            <div className="text-center space-y-2">
              <h3 className="font-semibold text-destructive">Weather data unavailable</h3>
              <p className="text-sm text-muted-foreground max-w-md">{error}</p>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={fetchWeather}
                className="mt-4"
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                Try Again
              </Button>
            </div>
          </div>
        )}

        {weatherData && !loading && !error && (
          <div className="space-y-3">
            {/* Compact Main Weather Display */}
            <div className="relative p-3 rounded-lg bg-gradient-to-br from-primary/5 to-primary/10 border border-primary/20">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="relative scale-75">
                    {getWeatherIcon(weatherData.current.icon, weatherData.current.description)}
                  </div>
                  <div>
                    <div className="text-2xl font-bold">
                      {weatherData.current.temperature}°C
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Feels {weatherData.current.feelsLike}°C
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-sm font-medium capitalize">{weatherData.current.description}</div>
                  <div className="text-xs text-muted-foreground">
                    {weatherData.current.location.name}
                  </div>
                </div>
              </div>
            </div>

            {/* Compact Weather Details */}
            <div className="grid grid-cols-4 gap-2">
              <div className="bg-background/60 border border-border/50 rounded-lg p-2 text-center">
                <Droplets className="h-4 w-4 text-primary/70 mx-auto mb-1" />
                <div className="text-sm font-medium">{weatherData.current.humidity}%</div>
                <div className="text-xs text-muted-foreground">Humidity</div>
              </div>
              <div className="bg-background/60 border border-border/50 rounded-lg p-2 text-center">
                <Wind className="h-4 w-4 text-muted-foreground mx-auto mb-1" />
                <div className="text-sm font-medium">{weatherData.current.windSpeed}km/h</div>
                <div className="text-xs text-muted-foreground">Wind</div>
              </div>
              <div className="bg-background/60 border border-border/50 rounded-lg p-2 text-center">
                <Eye className="h-4 w-4 text-primary/70 mx-auto mb-1" />
                <div className="text-sm font-medium">{weatherData.current.visibility}km</div>
                <div className="text-xs text-muted-foreground">Visibility</div>
              </div>
              {weatherData.current.uvIndex !== undefined ? (
                <div className="bg-background/60 border border-border/50 rounded-lg p-2 text-center">
                  <div className={`h-4 w-4 rounded-full ${getUVIndexColor(weatherData.current.uvIndex)} mx-auto mb-1`} />
                  <div className="text-sm font-medium">{weatherData.current.uvIndex}</div>
                  <div className="text-xs text-muted-foreground">UV</div>
                </div>
              ) : (
                <div className="bg-background/60 border border-border/50 rounded-lg p-2 text-center">
                  <Gauge className="h-4 w-4 text-primary/70 mx-auto mb-1" />
                  <div className="text-sm font-medium">{weatherData.current.pressure}</div>
                  <div className="text-xs text-muted-foreground">hPa</div>
                </div>
              )}
            </div>

            {/* Compact Sun Times */}
            {weatherData.current.sunrise && weatherData.current.sunset && (
              <div className="bg-primary/5 border border-border/50 rounded-lg p-2">
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-1">
                    <Sunrise className="h-3 w-3 text-primary/80" />
                    <span>{formatTime(weatherData.current.sunrise)}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Sunset className="h-3 w-3 text-primary/60" />
                    <span>{formatTime(weatherData.current.sunset)}</span>
                  </div>
                </div>
              </div>
            )}

            {/* Compact Plan Info & Recommendations */}
            <div className="bg-primary/5 border border-border/50 rounded-lg p-3">
              <div className="flex items-center gap-2 mb-2">
                <Calendar className="h-3 w-3 text-primary" />
                <span className="text-sm font-medium">Plan Weather</span>
                {(() => {
                  const planDate = new Date(date);
                  const now = new Date();
                  const timeDiffHours = (planDate.getTime() - now.getTime()) / (1000 * 60 * 60);
                  
                  if (timeDiffHours > 0 && timeDiffHours <= 120) {
                    return (
                      <span className="text-xs bg-primary/10 text-primary px-1.5 py-0.5 rounded-full">Forecast</span>
                    );
                  } else if (timeDiffHours > 120) {
                    return (
                      <span className="text-xs bg-muted text-muted-foreground px-1.5 py-0.5 rounded-full">Current</span>
                    );
                  } else {
                    return (
                      <span className="text-xs bg-primary/10 text-primary px-1.5 py-0.5 rounded-full">Live</span>
                    );
                  }
                })()}
              </div>
              <div className="text-xs text-muted-foreground mb-2">
                {new Date(date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })} at {new Date(date).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}
              </div>
              
              {/* Key Recommendations */}
              <div className="space-y-1">
                {(() => {
                  const recommendations = generatePersonalizedRecommendations(weatherData.current);
                  const keyRecommendations = recommendations.slice(0, 3); // Show only top 3
                  
                  return keyRecommendations.map((recommendation, index) => (
                    <div key={index} className="text-xs text-muted-foreground flex items-start gap-1">
                      <span className="text-primary mt-0.5 flex-shrink-0 text-xs">•</span>
                      <span className="leading-tight">{recommendation}</span>
                    </div>
                  ));
                })()}
                {generatePersonalizedRecommendations(weatherData.current).length === 0 && (
                  <div className="text-xs text-center text-muted-foreground italic">
                    Perfect conditions for your plan! 🌟
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}