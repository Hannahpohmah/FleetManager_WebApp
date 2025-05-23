import React, { useState, useEffect, useRef } from 'react';
import { MapPin, Loader, AlertCircle, MapIcon, Car } from 'lucide-react';

const RouteMap = ({ routes = [],driverLocations = [] }) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [mapData, setMapData] = useState([]);
  const [progress, setProgress] = useState(0);
  const [userLocation, setUserLocation] = useState(null);
  const [dataStatus, setDataStatus] = useState({
    noRoutes: false,
    noDrivers: false
  });
  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const driverMarkersRef = useRef([]); // Store driver markers for easy updates
  const abortControllersRef = useRef([]); // Store AbortControllers for cleanup
  const userMarkerRef = useRef(null); // Reference for user location marker
  
  // Check data availability on component mount
useEffect(() => {
  const routesEmpty = !routes || routes.length === 0;
  const driversEmpty = !driverLocations || driverLocations.length === 0;
  
  // Only update state if the values have changed
  setDataStatus(prevStatus => {
    // Only update if values are different from previous state
    if (prevStatus.noRoutes !== routesEmpty || prevStatus.noDrivers !== driversEmpty) {
      return {
        noRoutes: routesEmpty,
        noDrivers: driversEmpty
      };
    }
    return prevStatus; // Return previous state if nothing changed
  });
  
  // If both are empty, try to get user location
  if (routesEmpty && driversEmpty) {
    getUserLocation();
  }
  
  //console.log("RouteMap component received routes:", routes);
  //console.log("RouteMap component received driver locations:", driverLocations);
}, [routes, driverLocations]);
  // Get user's current location
  const getUserLocation = () => {
    // Only proceed if we don't already have user location
    if (userLocation === null && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const { latitude, longitude } = position.coords;
          setUserLocation([latitude, longitude]);
        },
        (error) => {
          console.error("Error getting user location:", error);
          // Default to Accra if we can't get user location
          setUserLocation([5.6037, -0.1870]);
        }
      );
    } else if (userLocation === null) {
      console.log("Geolocation not supported");
      // Default to Accra if geolocation is not supported
      setUserLocation([5.6037, -0.1870]);
    }
  };
  
  // Initialize the map
  useEffect(() => {
    if (!mapRef.current) return;
    
    // Create map instance if it doesn't exist
    if (!mapInstanceRef.current && window.L) {
      mapInstanceRef.current = window.L.map(mapRef.current).setView([5.6037, -0.1870], 13); // Default to Accra, Ghana
      
      // Add OpenStreetMap tile layer
      window.L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
      }).addTo(mapInstanceRef.current);
      
      // Store the routeLayers property directly on the map instance
      mapInstanceRef.current.routeLayers = [];
      
      // Complete loading state once map is initialized
      setLoading(false);
    }
    
    // Clean up on unmount
    return () => {
      // Cancel any pending requests
      abortControllersRef.current.forEach(controller => {
        try {
          controller.abort();
        } catch (err) {
          console.log('Error aborting request:', err);
        }
      });
      
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, []);

  // Display user location on map
  useEffect(() => {
    if (!mapInstanceRef.current || !userLocation) return;
    
    // Remove existing user marker if present
    if (userMarkerRef.current) {
      mapInstanceRef.current.removeLayer(userMarkerRef.current);
      userMarkerRef.current = null;
    }
    
    // Create user location marker
    userMarkerRef.current = window.L.marker(userLocation, {
      icon: window.L.divIcon({
        className: 'user-marker',
        html: `
          <div style="position: relative; width: 40px; height: 40px;">
            <div style="position: absolute; top: 0; left: 0; width: 40px; height: 40px; display: flex; align-items: center; justify-content: center;">
              <div style="background-color: #10b981; width: 30px; height: 30px; border-radius: 50%; border: 3px solid white; box-shadow: 0 0 5px rgba(0,0,0,0.3); display: flex; align-items: center; justify-content: center;">
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10"></circle>
                  <circle cx="12" cy="12" r="3"></circle>
                </svg>
              </div>
            </div>
            <div style="position: absolute; top: 30px; left: -20px; background-color: white; padding: 2px 6px; border-radius: 12px; font-size: 10px; white-space: nowrap; box-shadow: 0 1px 3px rgba(0,0,0,0.2);">Your Location</div>
          </div>
        `,
        iconSize: [40, 40],
        iconAnchor: [20, 20]
      })
    }).addTo(mapInstanceRef.current);
    
    // Only center map on user if no other points are available
    if ((!driverLocations || driverLocations.length === 0) && 
        (!routes || routes.length === 0)) {
      mapInstanceRef.current.setView(userLocation, 15);
    }
    
  }, [userLocation, driverLocations, routes]);

  // In the useEffect hook for driver markers
  useEffect(() => {
    if (!mapInstanceRef.current) return;
    
    // Clear previous driver markers
    driverMarkersRef.current.forEach(marker => {
      mapInstanceRef.current.removeLayer(marker);
    });
    driverMarkersRef.current = [];
    
    if (!driverLocations || driverLocations.length === 0) {
      // No driver locations to display
      console.log("No driver locations to display");
      mapInstanceRef.current.driverPoints = [];
      return;
    }
    
    console.log("Processing driver locations:", driverLocations);
    
    // Collect all driver points to use for bounds calculation later
    const driverPoints = [];
    
    // Add new driver markers
    driverLocations.forEach((driver, index) => {
      // Check for latitude/longitude directly on driver object
      if (!driver.latitude || !driver.longitude) {
        console.log(`Driver ${index} missing coordinates:`, driver);
        return;
      }
      
      // Collect driver location for bounds calculation
      const driverLocation = [driver.latitude, driver.longitude];
      driverPoints.push(driverLocation);
      
      console.log(`Adding driver marker for ${driver.driverName || 'Unknown'} at:`, driverLocation);
      
      // Create driver marker with custom icon that looks like a car
      const driverMarker = window.L.marker(driverLocation, {
        icon: window.L.divIcon({
          className: 'driver-marker',
          html: `
            <div style="position: relative; width: 40px; height: 40px;">
              <div style="position: absolute; top: 0; left: 0; width: 40px; height: 40px; display: flex; align-items: center; justify-content: center;">
                <div style="background-color: #3b82f6; width: 30px; height: 30px; border-radius: 50%; border: 3px solid white; box-shadow: 0 0 5px rgba(0,0,0,0.3); display: flex; align-items: center; justify-content: center; transform: rotate(${driver.heading || 0}deg);">
                  <!-- Car icon -->
                  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M14 16H9m10 0h3v-3.15a1 1 0 0 0-.84-.99L16 11l-2.7-3.6a1 1 0 0 0-.8-.4H5.24a2 2 0 0 0-1.8 1.1l-.8 1.63A6 6 0 0 0 2 12.42V16h2"></path>
                    <circle cx="6.5" cy="16.5" r="2.5"></circle>
                    <circle cx="16.5" cy="16.5" r="2.5"></circle>
                  </svg>
                </div>
              </div>
              ${driver.driverName ? `<div style="position: absolute; top: 30px; left: -30px; background-color: white; padding: 2px 6px; border-radius: 12px; font-size: 10px; white-space: nowrap; box-shadow: 0 1px 3px rgba(0,0,0,0.2);">${driver.driverName}</div>` : ''}
            </div>
          `,
          iconSize: [40, 40],
          iconAnchor: [20, 20]
        })
      }).addTo(mapInstanceRef.current);
      
      // Add popup with driver information
      const popupContent = `
        <div>
          <strong>${driver.driverName || `Driver ${index + 1}`}</strong>
          ${driver.status ? `<div>Status: ${driver.status}</div>` : ''}
          ${driver.vehicle ? `<div>Vehicle: ${driver.vehicle}</div>` : ''}
          ${driver.timestamp ? `<div>Last updated: ${new Date(driver.timestamp).toLocaleTimeString()}</div>` : ''}
        </div>
      `;
      
      driverMarker.bindPopup(popupContent);
      driverMarkersRef.current.push(driverMarker);
    });
    
    // Store driver points for later use in the combined bounds calculation
    mapInstanceRef.current.driverPoints = driverPoints;
    
    // If we don't have routes, fit bounds to driver locations now
    if (!routes || routes.length === 0) {
      fitMapToCombinedPoints();
    }
  }, [driverLocations]);
  const fitMapToCombinedPoints = () => {
    if (!mapInstanceRef.current) return;
    
    // Collect all points: driver locations, user location, and route points
    const allPoints = [];
    
    // Add driver points if available
    if (mapInstanceRef.current.driverPoints && mapInstanceRef.current.driverPoints.length > 0) {
      allPoints.push(...mapInstanceRef.current.driverPoints);
    }
    
    // Add user location if available
    if (userLocation) {
      allPoints.push(userLocation);
    }
    
    // Only fit bounds if we have points
    if (allPoints.length > 0) {
      try {
        const bounds = window.L.latLngBounds(allPoints);
        mapInstanceRef.current.fitBounds(bounds.pad(0.2));
      } catch (error) {
        console.error("Error setting map bounds:", error);
        // Fallback to default location
        mapInstanceRef.current.setView([5.6037, -0.1870], 13);
      }
    } else {
      // Fallback to default location
      mapInstanceRef.current.setView([5.6037, -0.1870], 13);
    }
  };

  // Geocode and display routes when routes change
  useEffect(() => {
    if (!mapInstanceRef.current) return;
    
    // If we have driver locations but no routes, skip the route processing
    if (!routes || routes.length === 0) {
      console.log("No routes to process - skipping route processing");
      return;
    }
    
    // Start routes processing
    setLoading(true);
    setError(null);
    setProgress(0);
    
    const geocodeAndDisplayRoutes = async () => {
      // Cancel any previous pending requests
      abortControllersRef.current.forEach(controller => {
        try {
          controller.abort();
        } catch (err) {
          console.log('Error aborting request:', err);
        }
      });
      abortControllersRef.current = [];
      
      try {
        // Process routes with detailed path information
        const routesWithPaths = await Promise.all(
          routes.map(async (route, index) => {
            // Calculate progress steps
            const totalRoutes = routes.length;
            const baseProgress = index / totalRoutes;
            
            // Validate and clean path segments if available
            const pathSegments = route.path 
              ? route.path.split('→')
                .map(s => s.trim())
                .filter(s => isValidStreetName(s)) // Filter out invalid street names
              : [];
            
            // Geocode start and end points as anchors
            const startPoint = await geocodeLocation(`${route.start}, Accra, Ghana`);
            setProgress(baseProgress + 0.1 / totalRoutes);
            
            // Get the end destination from streets array if available, otherwise use route.end
            const endDestination = route.streets && route.streets.length > 0
              ? route.streets[route.streets.length - 1]
              : route.end;
            
            const endPoint = await geocodeLocation(`${endDestination}, Accra, Ghana`);
            setProgress(baseProgress + 0.2 / totalRoutes);
            
            // If we have path segments, geocode each street in the path
            let streetPoints = [];
            if (pathSegments.length > 0) {
              // Use Promise.allSettled instead of Promise.all to handle failures better
              const streetPointResults = await Promise.allSettled(
                pathSegments.map(async (street, i) => {
                  // Update progress for each street
                  const streetProgress = baseProgress + 0.2 + ((i + 1) / pathSegments.length * 0.7);
                  setProgress(streetProgress / totalRoutes);
                  
                  // Geocode the street with Accra context
                  const result = await geocodeSingleStreet(street, "Accra, Ghana");
                  
                  // Respect Nominatim usage policy
                  if (i < pathSegments.length - 1) {
                    await new Promise(resolve => setTimeout(resolve, 1000));
                  }
                  
                  return { street, result };
                })
              );
              
              // Process the results, handling both fulfilled and rejected promises
              streetPoints = streetPointResults.map((result, i) => {
                if (result.status === 'fulfilled' && result.value.result) {
                  return result.value.result;
                } else {
                  console.warn(`Failed to geocode street: ${pathSegments[i]}`, 
                    result.status === 'rejected' ? result.reason : 'No result');
                  // Return synthetic data for failed geocoding
                  return createSyntheticStreetData(pathSegments[i], i, startPoint, endPoint);
                }
              });
            }
            
            return {
              ...route,
              startPoint: startPoint && startPoint.length > 0 ? startPoint[0] : createDefaultPoint(0),
              endPoint: endPoint && endPoint.length > 0 ? endPoint[0] : createDefaultPoint(1),
              pathSegments,
              streetPoints,
              // Store the true end destination for later use
              endDestination: endDestination
            };
          })
        );
        
        // Now process the routes to create connected path segments
        const processedRoutes = await Promise.all(
          routesWithPaths.map(async (route, index) => {
            const totalRoutes = routes.length;
            const baseProgress = 0.9 + (index / totalRoutes * 0.1);
            setProgress(baseProgress);
            
            // Build route segments from path data
            const routeSegments = await buildRouteFromPath(
              route.pathSegments,
              route.streetPoints,
              route.startPoint,
              route.endPoint
            );
            
            return { ...route, segments: routeSegments, geocoded: true };
          })
        );
        
        setMapData(processedRoutes);
        
        // Make sure we use the function we imported from your utility file
        if (typeof displayRoutesOnMap === 'function') {
          displayRoutesOnMap(processedRoutes);
        } else {
          console.error("displayRoutesOnMap function is not available");
        }
        
        // After routes are processed, fit map to all points
        fitMapToCombinedPoints();
      } catch (err) {
        console.error('Error processing routes:', err);
        setError('Failed to process routes: ' + err.message);
      } finally {
        setLoading(false);
        setProgress(1);
      }
    };
    
    geocodeAndDisplayRoutes();
  }, [routes]);

  // Validate street name to filter out IDs or invalid names
  const isValidStreetName = (name) => {
    if (!name) return false;
    
    // Filter out names that look like internal IDs
    if (/^Street_\d+$/.test(name)) return false;
    if (/^\d{5,}$/.test(name)) return false;
    
    // Filter out very short or excessively long names
    if (name.length < 2 || name.length > 100) return false;
    
    return true;
  };
  
  // Create a default synthetic point based on index (for start or end)
  const createDefaultPoint = (index) => {
    // Base coordinates in Accra
    const baseLatitude = 5.6037;
    const baseLongitude = -0.1870;
    
    // Offset based on index
    const latOffset = index * 0.005;
    const lngOffset = index * 0.005;
    
    return [baseLatitude + latOffset, baseLongitude + lngOffset];
  };
  
  // Create synthetic street data when geocoding fails
  const createSyntheticStreetData = (streetName, index, startPoint, endPoint) => {
    // Create a hash based on street name for consistent coordinates
    const hash = streetName.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    const latOffset = (hash % 100) / 10000;
    const lngOffset = ((hash * 2) % 100) / 10000;
    
    // If we have both start and end points, create street between them
    if (startPoint && startPoint.length > 0 && endPoint && endPoint.length > 0) {
      // Figure out where this street should lie between start and end
      const ratio = (index + 1) / (startPoint.length + 1);
      
      // Interpolate between start and end points
      const midLat = startPoint[0][0] + (endPoint[0][0] - startPoint[0][0]) * ratio;
      const midLng = startPoint[0][1] + (endPoint[0][1] - startPoint[0][1]) * ratio;
      
      // Create a synthetic street with slight variation to look natural
      const streetPoints = [
        [midLat - 0.001 + latOffset, midLng - 0.001 + lngOffset],
        [midLat + latOffset, midLng + lngOffset],
        [midLat + 0.001 + latOffset, midLng + 0.001 + lngOffset]
      ];
      
      return { 
        name: streetName, 
        points: streetPoints,
        isSynthetic: true
      };
    }
    
    // Fallback if no start/end coordinates
    const basePoint = [5.6037 + (index * 0.001) + latOffset, -0.1870 + (index * 0.001) + lngOffset];
    const streetPoints = [
      [basePoint[0] - 0.001, basePoint[1] - 0.001],
      basePoint,
      [basePoint[0] + 0.001, basePoint[1] + 0.001]
    ];
    
    return { 
      name: streetName, 
      points: streetPoints,
      isSynthetic: true
    };
  };

  // Build a connected route from path segments
  const buildRouteFromPath = async (pathSegments, streetPoints, startPoint, endPoint) => {
    // If no path segments, create a direct route
    if (!pathSegments || pathSegments.length === 0) {
      if (startPoint && endPoint) {
        const routePoints = await getRouteBetweenPoints(startPoint, endPoint);
        return [{
          name: "Direct Route",
          points: routePoints,
          isRoutedSegment: true
        }];
      }
      return [];
    }
    
    const routeSegments = [];
    
    // Process each street in the path to create connected segments
    for (let i = 0; i < pathSegments.length; i++) {
      const currentStreet = pathSegments[i];
      const currentStreetData = streetPoints[i];
      
      // Skip if we don't have valid street data
      if (!currentStreetData || !currentStreetData.points || currentStreetData.points.length === 0) {
        continue;
      }
      
      // For the first segment, connect from start point to the first street
      if (i === 0 && startPoint) {
        // Find the closest point on the street to the start point
        const closestPointIndex = findClosestPointIndex(startPoint, currentStreetData.points);
        const streetStartPoint = currentStreetData.points[closestPointIndex];
        
        // Create a segment from start point to the street
        const connectionPoints = await getRouteBetweenPoints(startPoint, streetStartPoint);
        routeSegments.push({
          name: `Start to ${currentStreet}`,
          points: connectionPoints,
          isRoutedSegment: true,
          isConnector: true
        });
        
        // Add the street segment itself
        // If we have a next street, only include points up to the mid or end based on direction
        let streetPoints = [...currentStreetData.points];
        if (pathSegments.length > 1 && i < pathSegments.length - 1) {
          const nextStreetData = streetPoints[i + 1];
          if (nextStreetData && nextStreetData.points && nextStreetData.points.length > 0) {
            // Determine which part of the street to include based on next street's position
            const nextClosestPoint = findClosestPoint(nextStreetData.points[0], currentStreetData.points);
            const nextClosestIndex = currentStreetData.points.indexOf(nextClosestPoint);
            
            if (nextClosestIndex !== -1) {
              // Keep only points up to the junction with the next street
              streetPoints = currentStreetData.points.slice(0, nextClosestIndex + 1);
            }
          }
        }
        
        routeSegments.push({
          name: currentStreet,
          points: streetPoints,
          isRoutedSegment: false,
          isStreet: true
        });
      }
      // For middle segments, connect from previous street to current
      else if (i > 0) {
        const prevStreetData = streetPoints[i - 1];
        
        if (prevStreetData && prevStreetData.points && prevStreetData.points.length > 0 &&
            currentStreetData.points && currentStreetData.points.length > 0) {
          // Find the endpoints of the streets that are closest to each other
          const prevEndPoint = prevStreetData.points[prevStreetData.points.length - 1];
          const currStartPoint = findClosestPoint(prevEndPoint, currentStreetData.points);
          
          // Create a connector segment between streets
          const connectionPoints = await getRouteBetweenPoints(prevEndPoint, currStartPoint);
          routeSegments.push({
            name: `${pathSegments[i-1]} to ${currentStreet}`,
            points: connectionPoints,
            isRoutedSegment: true,
            isConnector: true
          });
          
          // Add the current street segment
          routeSegments.push({
            name: currentStreet,
            points: currentStreetData.points,
            isRoutedSegment: false,
            isStreet: true
          });
        }
      }
      
      // For the last segment, connect to the end point
      if (i === pathSegments.length - 1 && endPoint) {
        const lastStreetEndPoint = currentStreetData.points[currentStreetData.points.length - 1];
        
        // Create a segment from the last street to the end point
        const connectionPoints = await getRouteBetweenPoints(lastStreetEndPoint, endPoint);
        routeSegments.push({
          name: `${currentStreet} to End`,
          points: connectionPoints,
          isRoutedSegment: true,
          isConnector: true
        });
      }
    }
    
    return routeSegments;
  };

  // Find the closest point in a list to a reference point
  const findClosestPoint = (referencePoint, pointsList) => {
    if (!pointsList || pointsList.length === 0) return null;
    
    let closestPoint = pointsList[0];
    let minDistance = calculateDistance(referencePoint, closestPoint);
    
    for (let i = 1; i < pointsList.length; i++) {
      const distance = calculateDistance(referencePoint, pointsList[i]);
      if (distance < minDistance) {
        minDistance = distance;
        closestPoint = pointsList[i];
      }
    }
    
    return closestPoint;
  };

  // Find the index of the closest point in a list to a reference point
  const findClosestPointIndex = (referencePoint, pointsList) => {
    if (!pointsList || pointsList.length === 0) return -1;
    
    let closestIndex = 0;
    let minDistance = calculateDistance(referencePoint, pointsList[0]);
    
    for (let i = 1; i < pointsList.length; i++) {
      const distance = calculateDistance(referencePoint, pointsList[i]);
      if (distance < minDistance) {
        minDistance = distance;
        closestIndex = i;
      }
    }
    
    return closestIndex;
  };

  // Calculate distance between two points in lat/lng
  const calculateDistance = (point1, point2) => {
    const lat1 = point1[0];
    const lon1 = point1[1];
    const lat2 = point2[0];
    const lon2 = point2[1];
    
    const R = 6371; // Radius of the earth in km
    const dLat = deg2rad(lat2 - lat1);
    const dLon = deg2rad(lon2 - lon1);
    const a = 
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) * 
      Math.sin(dLon/2) * Math.sin(dLon/2); 
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)); 
    const d = R * c; // Distance in km
    return d;
  };

  const deg2rad = (deg) => {
    return deg * (Math.PI/180);
  };

  // Geocode a location using OpenStreetMap's Nominatim API with improved error handling
  const geocodeLocation = async (location) => {
    try {
      // Check cache first
      const cacheKey = `osm_location_${location.replace(/\s+/g, '_')}`;
      const cachedResult = localStorage.getItem(cacheKey);
      if (cachedResult) {
        try {
          return JSON.parse(cachedResult);
        } catch (e) {
          console.warn("Failed to parse cached result:", e);
        }
      }
      
      const encodedLocation = encodeURIComponent(location);
      const url = `https://nominatim.openstreetmap.org/search?q=${encodedLocation}&format=json&limit=1`;
      
      // Create an AbortController for this request
      const controller = new AbortController();
      abortControllersRef.current.push(controller);
      
      // Set a timeout to abort the request if it takes too long
      const timeoutId = setTimeout(() => controller.abort(), 5000);
      
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'RouteMapWebApp/1.0' // Required by Nominatim usage policy
        },
        signal: controller.signal,
        // Add timeout
        timeout: 5000
      });
      
      clearTimeout(timeoutId);
      
      // Remove this controller from the list
      const index = abortControllersRef.current.indexOf(controller);
      if (index > -1) {
        abortControllersRef.current.splice(index, 1);
      }
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      
      if (!data || data.length === 0) {
        return null;
      }
      
      const result = [[parseFloat(data[0].lat), parseFloat(data[0].lon)]];
      
      // Cache the result
      localStorage.setItem(cacheKey, JSON.stringify(result));
      
      // Respect Nominatim usage policy with a small delay
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      return result;
    } catch (error) {
      console.error(`Error geocoding "${location}":`, error);
      
      // If this is an abort error, don't report it as a failure
      if (error.name === 'AbortError') {
        console.log(`Request for "${location}" was aborted`);
      }
      
      return null;
    }
  };

  // Improved geocoding for a single street with specific context and better error handling
  const geocodeSingleStreet = async (streetName, locationContext) => {
    // Validate the street name first
    if (!isValidStreetName(streetName)) {
      console.warn(`Invalid street name skipped: ${streetName}`);
      return createSyntheticStreetData(streetName, 0, null, null);
    }
    
    try {
      // Handle known streets in Accra with hardcoded coordinates
      const knownStreets = {
        "10th Street": [5.6025, -0.1870],
        "3rd Street": [5.6020, -0.1855]
        // Add other known streets as needed
      };
      
      if (knownStreets[streetName]) {
        // For known streets, return the hardcoded point and generate a synthetic line
        const basePoint = knownStreets[streetName];
        // Generate a synthetic line by slightly adjusting the coordinates
        const linePath = [
          [basePoint[0] - 0.001, basePoint[1] - 0.001],
          [basePoint[0], basePoint[1]],
          [basePoint[0] + 0.001, basePoint[1] + 0.001]
        ];
        
        return {
          name: streetName,
          points: linePath,
          isKnownStreet: true
        };
      }
      
      // Check cache first
      const cacheKey = `osm_street_${streetName.replace(/\s+/g, '_')}_${locationContext.replace(/\s+/g, '_')}`;
      const cachedResult = localStorage.getItem(cacheKey);
      if (cachedResult) {
        try {
          return JSON.parse(cachedResult);
        } catch (e) {
          console.warn("Failed to parse cached result:", e);
        }
      }
      
      // Try different query formats for better results
      const queries = [
        `${streetName}, ${locationContext}`,
        `${streetName} Street, ${locationContext}`,
        `${streetName} Road, ${locationContext}`,
        `${streetName} Avenue, ${locationContext}`
      ];
      
      // Create an AbortController for this request
      const controller = new AbortController();
      abortControllersRef.current.push(controller);
      
      // Set a timeout to abort the request if it takes too long
      const timeoutId = setTimeout(() => controller.abort(), 5000);
      
      // Try each query format until we get a result
      for (const query of queries) {
        const encodedQuery = encodeURIComponent(query);
        
        // Build Nominatim API URL with polygon_geojson to get street shape
        const url = `https://nominatim.openstreetmap.org/search?q=${encodedQuery}&format=json&polygon_geojson=1&limit=1`;
        
        try {
          const response = await fetch(url, {
            headers: {
              'User-Agent': 'RouteMapWebApp/1.0'
            },
            signal: controller.signal
          });
          
          if (!response.ok) {
            continue;
          }
          
          const data = await response.json();
          
          if (data && data.length > 0) {
            // Get the location and extract geometry
            const location = data[0];
            let streetShape = [];
            
            // Prefer LineString for more accurate routing
            if (location.geojson && location.geojson.type === 'LineString') {
              streetShape = location.geojson.coordinates.map(coord => [coord[1], coord[0]]);
            } else if (location.geojson && location.geojson.type === 'MultiLineString') {
              // For MultiLineString, concatenate all segments
              streetShape = location.geojson.coordinates.flatMap(line => 
                line.map(coord => [coord[1], coord[0]])
              );
            } else {
              // Fallback to a line centered on the point if no LineString
              const point = [parseFloat(location.lat), parseFloat(location.lon)];
              streetShape = [
                [point[0] - 0.0005, point[1] - 0.0005],
                point,
                [point[0] + 0.0005, point[1] + 0.0005]
              ];
            }
            
            clearTimeout(timeoutId);
            
            // Remove this controller from the list
            const index = abortControllersRef.current.indexOf(controller);
            if (index > -1) {
              abortControllersRef.current.splice(index, 1);
            }
            
            const result = { 
              name: streetName, 
              points: streetShape,
              display_name: location.display_name,
              osm_type: location.osm_type,
              osm_id: location.osm_id
            };
            
            // Cache the result
            localStorage.setItem(cacheKey, JSON.stringify(result));
            
            return result;
          }
          
          // Respect Nominatim usage policy
          await new Promise(resolve => setTimeout(resolve, 1000));
        } catch (error) {
          // Check if this was an abort error
          if (error.name === 'AbortError') {
            console.log(`Request for "${query}" was aborted due to timeout`);
            break; // Stop trying more queries if we got an abort
          }
          
          console.error(`Error trying query "${query}":`, error);
          // Continue to next query format
        }
      }
      
      // Clear the timeout and remove the controller
      clearTimeout(timeoutId);
      const index = abortControllersRef.current.indexOf(controller);
      if (index > -1) {
        abortControllersRef.current.splice(index, 1);
      }
      
      // If no results from API, use synthetic data for the street
      console.warn(`Street not found: ${streetName}. Using synthetic data.`);
      
      // Create synthetic coordinate based on street name hash for consistency
      const hash = streetName.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
      const latOffset = (hash % 100) / 10000;
      const lngOffset = ((hash * 2) % 100) / 10000;
      
      // Base around Accra
      const basePoint = [5.6037 + latOffset, -0.1870 + lngOffset];
      const streetPoints = [
        [basePoint[0] - 0.001, basePoint[1] - 0.001],
        basePoint,
        [basePoint[0] + 0.001, basePoint[1] + 0.001]
      ];
      
      return { 
        name: streetName, 
        points: streetPoints,
        isSynthetic: true
      };
    } catch (error) {
      console.error(`Error geocoding "${streetName}":`, error);
      return createSyntheticStreetData(streetName, 0, null, null);
    }
  };

  // Get a route between two points using OSRM if available, with better error handling
  const getRouteBetweenPoints = async (fromPoint, toPoint) => {
    try {
      // Create an AbortController for this request
      const controller = new AbortController();
      abortControllersRef.current.push(controller);
      
      // Set a timeout to abort the request if it takes too long
      const timeoutId = setTimeout(() => controller.abort(), 30000);
      
      // Try using OSRM for better routing
      const url = `https://router.project-osrm.org/route/v1/driving/${fromPoint[1]},${fromPoint[0]};${toPoint[1]},${toPoint[0]}?overview=full&geometries=geojson`;
      
      const response = await fetch(url, {
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      
      // Remove this controller from the list
      const index = abortControllersRef.current.indexOf(controller);
      if (index > -1) {
        abortControllersRef.current.splice(index, 1);
      }
      
      if (response.ok) {
        const data = await response.json();
        
        if (data.routes && data.routes.length > 0 && data.routes[0].geometry) {
          // Extract the coordinates from the GeoJSON
          const coordinates = data.routes[0].geometry.coordinates;
          
          // Convert to [lat, lng] format from OSRM's [lng, lat]
          return coordinates.map(coord => [coord[1], coord[0]]);
        }
      }
      
      // Fallback to straight line if OSRM fails
      return [fromPoint, toPoint];
    } catch (error) {
      console.error("Error getting route from OSRM:", error);
      
      // If this is an abort error, don't worry too much
      if (error.name === 'AbortError') {
        console.log('OSRM request was aborted due to timeout');
      }
      
      // Fallback to direct line
      return [fromPoint, toPoint];
    }
  };

  // Display routes on the map with improved styling and accuracy
  // Utility functions
const mapUtils = {
  getRouteColor: (index) => {
    const colors = ['#3b82f6', '#ef4444', '#10b981', '#f97316', '#8b5cf6', '#ec4899'];
    return colors[index % colors.length];
  },
  
  createMarker: (point, options) => {
    return window.L.marker(point, {
      icon: window.L.divIcon(options)
    });
  },
  
  fitMapToPoints: (map, points, padding = 0.2) => {
    if (points.length > 0) {
      try {
        const bounds = window.L.latLngBounds(points);
        map.fitBounds(bounds.pad(padding));
      } catch (error) {
        console.error("Error setting map bounds:", error);
        // Fallback to Accra as center
        map.setView([5.6037, -0.1870], 13);
      }
    }
  }
};

// Marker creators
const markerCreators = {
  createStartMarker: (point, routeColor) => {
    return mapUtils.createMarker(point, {
      className: 'start-marker',
      html: `<div style="background-color: ${routeColor}; width: 20px; height: 20px; border-radius: 50%; border: 3px solid white; box-shadow: 0 0 5px rgba(0,0,0,0.3); display: flex; align-items: center; justify-content: center; color: white; font-weight: bold; font-size: 12px;">S</div>`,
      iconSize: [26, 26],
      iconAnchor: [13, 13]
    });
  },
  
  createEndMarker: (point, routeColor) => {
    return mapUtils.createMarker(point, {
      className: 'end-marker',
      html: `<div style="background-color: ${routeColor}; width: 20px; height: 20px; border-radius: 50%; border: 3px solid white; box-shadow: 0 0 5px rgba(0,0,0,0.3); display: flex; align-items: center; justify-content: center; color: white; font-weight: bold; font-size: 12px;">E</div>`,
      iconSize: [26, 26],
      iconAnchor: [13, 13]
    });
  },
  
  createStopMarker: (point, routeColor, index) => {
    return mapUtils.createMarker(point, {
      className: 'stop-marker',
      html: `<div style="background-color: ${routeColor}; width: 18px; height: 18px; border-radius: 50%; border: 2px solid white; box-shadow: 0 0 4px rgba(0,0,0,0.3); display: flex; align-items: center; justify-content: center; color: white; font-weight: bold; font-size: 10px;">${index+1}</div>`,
      iconSize: [18, 18],
      iconAnchor: [9, 9]
    });
  },
  
  createWaypointMarker: (point, routeColor) => {
    return mapUtils.createMarker(point, {
      className: 'waypoint-marker',
      html: `<div style="background-color: ${routeColor}; width: 16px; height: 16px; border-radius: 50%; border: 2px solid white; box-shadow: 0 0 4px rgba(0,0,0,0.3);"></div>`,
      iconSize: [16, 16],
      iconAnchor: [8, 8]
    });
  },
  
  createStreetLabel: (point, routeColor, streetName) => {
    return mapUtils.createMarker(point, {
      className: 'street-label',
      html: `<div style="background-color: white; padding: 2px 5px; border-radius: 3px; font-size: 10px; font-weight: bold; color: ${routeColor}; border: 1px solid ${routeColor}; white-space: nowrap;">${streetName}</div>`,
      iconSize: [150, 20],
      iconAnchor: [75, 10]
    });
  }
};

// Route processing functions 
const routeProcessors = {
  clearPreviousRoutes: (map) => {
    if (map.routeLayers) {
      map.routeLayers.forEach(layer => {
        map.removeLayer(layer);
      });
    }
    map.routeLayers = [];
  },
  
  processRouteSegments: (map, route, routeColor, allRoutePoints) => {
    if (!route.segments || route.segments.length === 0) return;
    
    route.segments.forEach((segment, segmentIndex) => {
      if (!segment.points || segment.points.length === 0) return;
      
      // Add points to the collection for map bounds
      allRoutePoints.push(...segment.points);
      
      // Create a polyline for this segment
      const routeLine = window.L.polyline(segment.points, {
        color: routeColor,
        weight: segment.isConnector ? 3 : 5,
        opacity: segment.isConnector ? 0.6 : 0.8,
        dashArray: segment.isConnector ? "5, 5" : null
      }).addTo(map);
      
      routeLine.bindPopup(`<strong>${segment.name}</strong>`);
      map.routeLayers.push(routeLine);
    });
  },
  
  addStartEndMarkers: (map, route, routeColor, allRoutePoints) => {
    const endDestination = route.endDestination || route.end;
    
    // Add start marker
    if (route.startPoint) {
      const startMarker = markerCreators.createStartMarker(route.startPoint, routeColor)
        .addTo(map);
      
      startMarker.bindPopup(`<strong>Start: ${route.start}</strong>`);
      map.routeLayers.push(startMarker);
      allRoutePoints.push(route.startPoint);
    }
    
    // Add end marker
    if (route.endPoint) {
      const endMarker = markerCreators.createEndMarker(route.endPoint, routeColor)
        .addTo(map);
      
      endMarker.bindPopup(`<strong>End: ${endDestination}</strong>`);
      map.routeLayers.push(endMarker);
      allRoutePoints.push(route.endPoint);
    }
  },
  
  findDestinationPoint: (route, destination) => {
    // Find point for the destination in different possible data structures
    let point = null;
    
    // Check in streets array
    const streetIndex = route.streets ? route.streets.indexOf(destination) : -1;
    if (streetIndex >= 0) {
      if (route.streetPoints && route.streetPoints[streetIndex] && 
          route.streetPoints[streetIndex].points && route.streetPoints[streetIndex].points.length > 0) {
        point = route.streetPoints[streetIndex].points[0];
      }
    } else {
      // Check in pathSegments
      const pathIndex = route.pathSegments ? route.pathSegments.indexOf(destination) : -1;
      if (pathIndex >= 0 && route.streetPoints && route.streetPoints[pathIndex]) {
        point = route.streetPoints[pathIndex].points[0];
      }
    }
    
    // Search by name in all streetPoints
    if (!point && route.streetPoints) {
      const matchingStreet = route.streetPoints.find(sp => sp.name === destination);
      if (matchingStreet && matchingStreet.points && matchingStreet.points.length > 0) {
        point = matchingStreet.points[0];
      }
    }
    
    return point;
  },
  
  addStopMarkers: async (map, route, routeColor) => {
    if (!route.destinations || route.destinations.length === 0) return;
    
    // Mark this as a multi-stop route
    route.isMultiStop = true;
    const endDestination = route.endDestination || route.end;
    
    // Process each destination except the final one
    route.destinations.forEach(async (destination, idx) => {
      // Skip the last destination as it's already marked as the end
      if (idx === route.destinations.length - 1 && destination === endDestination) return;
      
      // Find point for this destination
      let point = routeProcessors.findDestinationPoint(route, destination);
      
      // If we have a point, create the marker
      if (point) {
        const stopMarker = markerCreators.createStopMarker(point, routeColor, idx)
          .addTo(map);
        
        stopMarker.bindPopup(`<strong>Stop ${idx+1}: ${destination}</strong>`);
        map.routeLayers.push(stopMarker);
      } else {
        // Fallback to geocoding
        try {
          const geocodedPoint = await geocodeLocation(`${destination}, Accra, Ghana`);
          if (geocodedPoint && geocodedPoint.length > 0) {
            const stopMarker = markerCreators.createStopMarker(geocodedPoint[0], routeColor, idx)
              .addTo(map);
            
            stopMarker.bindPopup(`<strong>Stop ${idx+1}: ${destination}</strong>`);
            map.routeLayers.push(stopMarker);
          }
        } catch (error) {
          console.error(`Failed to geocode waypoint: ${destination}`, error);
        }
      }
    });
  },
  
  addWaypointMarkers: (map, route, routeColor) => {
    if (!route.pathSegments || route.pathSegments.length === 0) return;
    
    route.pathSegments.forEach((streetName, idx) => {
      if (idx === 0 || idx === route.pathSegments.length - 1) return; // Skip first and last
      
      if (route.streetPoints && route.streetPoints[idx] && 
          route.streetPoints[idx].points && route.streetPoints[idx].points.length > 0) {
        const point = route.streetPoints[idx].points[0];
        const waypointMarker = markerCreators.createWaypointMarker(point, routeColor)
          .addTo(map);
        
        waypointMarker.bindPopup(`<strong>Waypoint: ${streetName}</strong>`);
        map.routeLayers.push(waypointMarker);
      }
    });
  },
  
  addStreetLabels: (map, route, routeColor) => {
    if (!route.pathSegments || !route.streetPoints) return;
    
    route.pathSegments.forEach((streetName, idx) => {
      const streetData = route.streetPoints[idx];
      if (streetData && streetData.points && streetData.points.length > 0) {
        // Add label at the midpoint of the street
        const midIndex = Math.floor(streetData.points.length / 2);
        const labelPoint = streetData.points[midIndex] || streetData.points[0];
        
        const streetLabel = markerCreators.createStreetLabel(labelPoint, routeColor, streetName)
          .addTo(map);
        
        map.routeLayers.push(streetLabel);
      }
    });
  }
};

// Main function
const displayRoutesOnMap = async (geocodedRoutes) => {
  const map = mapInstanceRef.current;
  if (!map) return;
  
  // Clear previous routes
  routeProcessors.clearPreviousRoutes(map);
  
  const allRoutePoints = [];
  
  // Process each route
  for (const [routeIndex, route] of geocodedRoutes.entries()) {
    const routeColor = mapUtils.getRouteColor(routeIndex);
    
    // Process route segments
    routeProcessors.processRouteSegments(map, route, routeColor, allRoutePoints);
    
    // Add start and end markers
    routeProcessors.addStartEndMarkers(map, route, routeColor, allRoutePoints);
    
    // Add stop markers for multi-stop routes
    await routeProcessors.addStopMarkers(map, route, routeColor);
    
    // Add waypoint markers
    routeProcessors.addWaypointMarkers(map, route, routeColor);
    
    // Add street labels
    routeProcessors.addStreetLabels(map, route, routeColor);
  }
  
  // Combine with any existing driver points
  const driverPoints = map.driverPoints || [];
  const allCombinedPoints = [...allRoutePoints, ...driverPoints];
  
  // Fit the map to show all points
  mapUtils.fitMapToPoints(map, allCombinedPoints);
};


  return (
    <div className="w-full p-4 bg-white shadow rounded-lg">
      <div className="flex justify-between items-center mb-4">
     
        {loading && (
          <div className="flex items-center text-sm text-gray-500">
            <Loader size={16} className="mr-2 animate-spin" />
            Processing routes...
          </div>
        )}
      </div>
      
      {/* Data Status Alerts */}
      {(dataStatus.noRoutes || dataStatus.noDrivers) && !loading && (
        <div className="mb-4">
          {dataStatus.noRoutes && dataStatus.noDrivers ? (
            <div className="p-3 bg-yellow-50 border border-yellow-200 rounded flex items-start">
              <AlertCircle size={18} className="text-yellow-500 mt-0.5 mr-2" />
              <div>
                <p className="text-yellow-700 font-medium">No route or driver data available</p>
                <p className="text-yellow-600 text-sm">Showing map centered on {userLocation ? 'your location' : 'Accra, Ghana'}</p>
              </div>
            </div>
          ) : (
            <>
              {dataStatus.noRoutes && (
                <div className="p-3 mb-2 bg-blue-50 border border-blue-200 rounded flex items-start">
                  <MapIcon size={18} className="text-blue-500 mt-0.5 mr-2" />
                  <div>
                    <p className="text-blue-700">No route data available</p>
                    <p className="text-blue-600 text-sm">Displaying available driver locations</p>
                  </div>
                </div>
              )}
              
              {dataStatus.noDrivers && (
                <div className="p-3 bg-blue-50 border border-blue-200 rounded flex items-start">
                  <Car size={18} className="text-blue-500 mt-0.5 mr-2" />
                  <div>
                    <p className="text-blue-700">No driver data available</p>
                    <p className="text-blue-600 text-sm">Displaying available routes</p>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}
      
      {error && (
        <div className="p-4 mb-4 bg-red-50 text-red-600 rounded">
          <p>{error}</p>
        </div>
      )}
      
      <div className="relative">
        <div ref={mapRef} style={{ height: '500px' }} className="rounded-lg border border-gray-200"></div>
        
        {loading && (
          <div className="absolute inset-0 bg-white bg-opacity-70 flex items-center justify-center">
            <div className="text-center">
              <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
              <p className="text-sm text-gray-700">Processing routes...</p>
              <div className="w-64 h-2 bg-gray-200 rounded-full mt-2">
                <div
                  className="h-full bg-blue-600 rounded-full"
                  style={{ width: `${progress * 100}%` }}
                ></div>
              </div>
              <p className="text-xs text-gray-500 mt-1">
                {Math.round(progress * 100)}% complete
              </p>
            </div>
          </div>
        )}
      </div>
      
      {!loading && (
        <div className="mt-4">
          {/* Route Legend */}
          {routes && routes.length > 0 && mapData.length > 0 && (
            <>
              <h5 className="font-medium mb-2">Routes Legend</h5>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {mapData.map((route, index) => {
                  // For the end, use the last item in streets array if available
                  const endStreet = route.streets && route.streets.length > 0 
                    ? route.streets[route.streets.length - 1] 
                    : (route.destinations && route.destinations.length > 0 
                      ? route.destinations[route.destinations.length - 1] 
                      : route.end);
                  
                  // Calculate the number of streets to show in the shortened path (at most 3)
                  const maxStreets = 3;
                  let pathDisplay = '';
                  
                  if (route.streets && route.streets.length > 0) {
                    if (route.streets.length <= maxStreets + 2) {
                      // If we have few streets, show all of them except start/end
                      const middleStreets = route.streets.slice(1, -1);
                      pathDisplay = middleStreets.length > 0 ? `via ${middleStreets.join(' → ')}` : '';
                    } else {
                      // If we have many streets, show the first one, ellipsis, and the last one before the end
                      pathDisplay = `via ${route.streets[1]} → ... → ${route.streets[route.streets.length - 2]}`;
                    }
                  }
                  
                  return (
                    <div key={index} className="flex items-center">
                      <div
                        className="w-4 h-4 rounded-full mr-2 flex-shrink-0"
                        style={{ backgroundColor: getRouteColor(index) }}
                      ></div>
                      <div className="text-sm overflow-hidden">
                        <span className="font-medium">{route.start} to {endStreet}</span>
                        {pathDisplay && (
                          <span className="text-xs text-gray-500 ml-1 block md:inline">
                            {pathDisplay}
                          </span>
                        )}
                        {route.isMultiStop && route.destinations && route.destinations.length > 1 && (
                          <span className="text-xs text-blue-500 ml-1 block">
                            Multi-stop route ({route.destinations.length} stops)
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
          
          {/* Driver Legend */}
          {driverLocations && driverLocations.length > 0 && (
            <>
              <h5 className="font-medium mt-4 mb-2">Drivers</h5>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {driverLocations.map((driver, index) => (
                  <div key={index} className="flex items-center p-2 border rounded bg-gray-50">
                    <div className="flex-shrink-0 w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center mr-2">
                      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M14 16H9m10 0h3v-3.15a1 1 0 0 0-.84-.99L16 11l-2.7-3.6a1 1 0 0 0-.8-.4H5.24a2 2 0 0 0-1.8 1.1l-.8 1.63A6 6 0 0 0 2 12.42V16h2"></path>
                        <circle cx="6.5" cy="16.5" r="2.5"></circle>
                        <circle cx="16.5" cy="16.5" r="2.5"></circle>
                      </svg>
                    </div>
                    <div className="text-sm overflow-hidden">
                      <div className="font-medium">{driver.driverName || `Driver ${index + 1}`}</div>
                      {driver.status && <div className="text-xs text-gray-600">Status: {driver.status}</div>}
                      {driver.timestamp && <div className="text-xs text-gray-600">Last seen: {new Date(driver.timestamp).toLocaleTimeString()}</div>}
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
          
          {/* User Location Note */}
          {dataStatus.noRoutes && dataStatus.noDrivers && userLocation && (
            <div className="mt-4 text-center text-sm text-gray-500">
              <p>Map centered on your current location</p>
              <p className="text-xs">Coordinates: {userLocation[0].toFixed(4)}, {userLocation[1].toFixed(4)}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// Function to get a color for each route
const getRouteColor = (index) => {
  const colors = ['#3b82f6', '#ef4444', '#10b981', '#f97316', '#8b5cf6', '#ec4899'];
  return colors[index % colors.length];
};

export default RouteMap;