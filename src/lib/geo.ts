export function distanceKm(
  origin: { lat: number; lng: number },
  destination: { lat: number; lng: number },
): number {
  const radians = Math.PI / 180;
  const latitudeDelta = (destination.lat - origin.lat) * radians;
  const longitudeDelta = (destination.lng - origin.lng) * radians;
  const originLatitude = origin.lat * radians;
  const destinationLatitude = destination.lat * radians;
  const haversine = Math.sin(latitudeDelta / 2) ** 2
    + Math.cos(originLatitude) * Math.cos(destinationLatitude) * Math.sin(longitudeDelta / 2) ** 2;

  return 6371 * 2 * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine));
}