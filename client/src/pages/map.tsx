
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { MapContainer, TileLayer, Marker, Popup, Polyline } from "react-leaflet";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { Operation, Client } from "@shared/schema";
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { Fragment } from "react";

// Fix leaflet default icon issue
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png",
  iconUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png",
  shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png",
});

const statusColors = {
  planning: "#3B82F6",
  "in-progress": "#F59E0B",
  completed: "#10B981",
  cancelled: "#EF4444",
};

const shippingModeIcons = {
  sea: "🚢",
  air: "✈️",
  land: "🚛",
  multimodal: "🌐",
};

// Coordenadas de ejemplo para ciudades principales
const cityCoordinates: Record<string, [number, number]> = {
  "new york": [40.7128, -74.0060],
  "los angeles": [34.0522, -118.2437],
  "chicago": [41.8781, -87.6298],
  "houston": [29.7604, -95.3698],
  "miami": [25.7617, -80.1918],
  "san francisco": [37.7749, -122.4194],
  "seattle": [47.6062, -122.3321],
  "boston": [42.3601, -71.0589],
  "atlanta": [33.7490, -84.3880],
  "mexico city": [19.4326, -99.1332],
  "guadalajara": [20.6597, -103.3496],
  "monterrey": [25.6866, -100.3161],
  "tijuana": [32.5149, -117.0382],
  "london": [51.5074, -0.1278],
  "paris": [48.8566, 2.3522],
  "tokyo": [35.6762, 139.6503],
  "shanghai": [31.2304, 121.4737],
  "singapore": [1.3521, 103.8198],
  "dubai": [25.2048, 55.2708],
  "sydney": [-33.8688, 151.2093],
};

function getCoordinatesFromAddress(address: string | null): [number, number] | null {
  if (!address) return null;
  
  const lowerAddress = address.toLowerCase();
  for (const [city, coords] of Object.entries(cityCoordinates)) {
    if (lowerAddress.includes(city)) {
      return coords;
    }
  }
  return null;
}

export default function MapPage() {
  const [selectedStatus, setSelectedStatus] = useState<string>("all");
  const [selectedMode, setSelectedMode] = useState<string>("all");

  const { data: operations = [], isLoading } = useQuery<Operation[]>({
    queryKey: ["/api/operations"],
  });

  const { data: clients = [] } = useQuery<Client[]>({
    queryKey: ["/api/clients"],
  });

  // Filtrar operaciones
  const filteredOperations = operations.filter((op) => {
    if (selectedStatus !== "all" && op.status !== selectedStatus) return false;
    if (selectedMode !== "all" && op.shippingMode !== selectedMode) return false;
    return true;
  });

  // Preparar datos para el mapa
  const mapData = filteredOperations
    .map((op) => {
      const pickupCoords = getCoordinatesFromAddress(op.pickUpAddress);
      const deliveryCoords = getCoordinatesFromAddress(op.deliveryAddress);
      const client = clients.find((c) => c.id === op.clientId);

      return {
        operation: op,
        client,
        pickupCoords,
        deliveryCoords,
      };
    })
    .filter((item) => item.pickupCoords || item.deliveryCoords);

  const statusCounts = {
    planning: operations.filter((op) => op.status === "planning").length,
    "in-progress": operations.filter((op) => op.status === "in-progress").length,
    completed: operations.filter((op) => op.status === "completed").length,
    cancelled: operations.filter((op) => op.status === "cancelled").length,
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-[600px] w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Operations Map</h1>
        <p className="text-muted-foreground mt-2">Track shipments in real-time</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="bg-blue-500/10 border-blue-500/20">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">Planning</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-blue-500">{statusCounts.planning}</div>
          </CardContent>
        </Card>

        <Card className="bg-yellow-500/10 border-yellow-500/20">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">In Progress</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-yellow-500">{statusCounts["in-progress"]}</div>
          </CardContent>
        </Card>

        <Card className="bg-green-500/10 border-green-500/20">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">Completed</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-green-500">{statusCounts.completed}</div>
          </CardContent>
        </Card>

        <Card className="bg-red-500/10 border-red-500/20">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">Cancelled</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-red-500">{statusCounts.cancelled}</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Shipment Tracking</CardTitle>
            <div className="flex gap-2">
              <Select value={selectedStatus} onValueChange={setSelectedStatus}>
                <SelectTrigger className="w-[150px]">
                  <SelectValue placeholder="All Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="planning">Planning</SelectItem>
                  <SelectItem value="in-progress">In Progress</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
                </SelectContent>
              </Select>

              <Select value={selectedMode} onValueChange={setSelectedMode}>
                <SelectTrigger className="w-[150px]">
                  <SelectValue placeholder="All Modes" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Modes</SelectItem>
                  <SelectItem value="sea">Sea</SelectItem>
                  <SelectItem value="air">Air</SelectItem>
                  <SelectItem value="land">Land</SelectItem>
                  <SelectItem value="multimodal">Multimodal</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="h-[600px] rounded-lg overflow-hidden border border-border">
            <MapContainer
              center={[20, 0]}
              zoom={2}
              style={{ height: "100%", width: "100%" }}
              className="z-0"
            >
              <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />

              {mapData.map((item) => {
                const { operation, client, pickupCoords, deliveryCoords } = item;
                const color = statusColors[operation.status as keyof typeof statusColors];
                const modeIcon = shippingModeIcons[operation.shippingMode as keyof typeof shippingModeIcons];

                return (
                  <Fragment key={operation.id}>
                    {pickupCoords && (
                      <Marker position={pickupCoords}>
                        <Popup>
                          <div className="p-2 min-w-[200px]">
                            <div className="font-bold text-sm mb-2">{operation.name}</div>
                            <div className="text-xs space-y-1">
                              <div>
                                <span className="font-medium">Mode:</span> {modeIcon} {operation.shippingMode}
                              </div>
                              <div>
                                <span className="font-medium">Type:</span> {operation.operationType}
                              </div>
                              <div>
                                <span className="font-medium">Client:</span> {client?.name || "N/A"}
                              </div>
                              <div>
                                <span className="font-medium">Status:</span>{" "}
                                <span style={{ color }}>{operation.status}</span>
                              </div>
                              {operation.pickUpAddress && (
                                <div>
                                  <span className="font-medium">From:</span> {operation.pickUpAddress}
                                </div>
                              )}
                            </div>
                          </div>
                        </Popup>
                      </Marker>
                    )}

                    {deliveryCoords && (
                      <Marker position={deliveryCoords}>
                        <Popup>
                          <div className="p-2 min-w-[200px]">
                            <div className="font-bold text-sm mb-2">{operation.name}</div>
                            <div className="text-xs space-y-1">
                              <div>
                                <span className="font-medium">Delivery Address:</span>{" "}
                                {operation.deliveryAddress}
                              </div>
                              {operation.eta && (
                                <div>
                                  <span className="font-medium">ETA:</span>{" "}
                                  {new Date(operation.eta).toLocaleDateString()}
                                </div>
                              )}
                            </div>
                          </div>
                        </Popup>
                      </Marker>
                    )}

                    {pickupCoords && deliveryCoords && (
                      <Polyline
                        positions={[pickupCoords, deliveryCoords]}
                        color={color}
                        weight={3}
                        opacity={0.6}
                        dashArray={operation.status === "completed" ? undefined : "10, 10"}
                      />
                    )}
                  </Fragment>
                );
              })}
            </MapContainer>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Active Shipments</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {filteredOperations.length === 0 ? (
              <p className="text-muted-foreground text-center py-8">No shipments found with the selected filters</p>
            ) : (
              filteredOperations.map((op) => {
                const client = clients.find((c) => c.id === op.clientId);
                const modeIcon = shippingModeIcons[op.shippingMode as keyof typeof shippingModeIcons];

                return (
                  <div
                    key={op.id}
                    className="flex items-center justify-between p-3 rounded-lg border border-border hover:bg-accent/50 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div className="text-2xl">{modeIcon}</div>
                      <div>
                        <div className="font-medium text-sm">{op.name}</div>
                        <div className="text-xs text-muted-foreground">
                          {client?.name || "N/A"} • {op.operationType}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      {op.eta && (
                        <div className="text-xs text-muted-foreground">
                          ETA: {new Date(op.eta).toLocaleDateString()}
                        </div>
                      )}
                      <Badge
                        style={{
                          backgroundColor: statusColors[op.status as keyof typeof statusColors] + "20",
                          color: statusColors[op.status as keyof typeof statusColors],
                          borderColor: statusColors[op.status as keyof typeof statusColors],
                        }}
                        className="border"
                      >
                        {op.status}
                      </Badge>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
