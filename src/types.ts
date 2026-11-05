export const TAPF_LOGO_URL = 'https://i.ibb.co/PZJY9FRv/images.jpg';

export interface School {
  id: number;
  nodeGroup: string;
  nodeGroupName: string;
  schoolName: string;
  udise: string;
  routeCode: string;
  nodeCode: string;
  routeName: string;
  lat: number;
  lon: number;
  driverName: string;
  driverContact: string;
  routeExecutive: string;
  routeExecutiveContact: string;
  address: string;
  pincode: string;
  spocName: string;
  spocContact: string;
  category: string;
  updatedBy?: string;
  updatedByStaffId?: string;
  updatedAt?: string;
}

export interface RouteConfig {
  id: string;
  routeName: string;
  routeCode: string;
  color: string;
  routeExecutive?: string;
  routeExecutiveContact?: string;
  createdAt?: string;
  updatedByStaffId?: string;
}

export interface StaffMember {
  id: string;
  name: string;
  loginId: string;
  passwordHash: string;
  passwordHint?: string;
  role: string;
  canEdit: boolean;
  active: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export const ROUTE_COLORS: Record<string, string> = {
  'BAIRI': '#e8a33d',
  'Barra': '#7fb298',
  'GOVIND NAGAR': '#7c9ee0',
  'KIDWAI NAGAR': '#d16257',
  'Shastri Nagar': '#c99be0',
  'VIJAY NAGAR': '#e0c25c',
};

export const ROUTE_COLOR_PALETTE = [
  '#e8a33d', // Warm Amber
  '#7fb298', // Sage Mint
  '#7c9ee0', // Periwinkle Blue
  '#d16257', // Terracotta Coral
  '#c99be0', // Soft Lavender
  '#e0c25c', // Golden Ochre
  '#4db6ac', // Teal Cyan
  '#f06292', // Rose Pink
  '#aed581', // Lime Leaf
  '#ff8a65', // Sunset Orange
];

export const DEFAULT_ROUTE_COLOR = '#7fb298';

export const KNOWN_ROUTES = [
  'BAIRI',
  'Barra',
  'GOVIND NAGAR',
  'KIDWAI NAGAR',
  'Shastri Nagar',
  'VIJAY NAGAR'
] as const;

export const DEFAULT_ROUTES: RouteConfig[] = [
  { id: 'route_vijay_nagar', routeName: 'VIJAY NAGAR', routeCode: 'RC00002', color: '#e0c25c', routeExecutive: 'Ayush Gupta', routeExecutiveContact: '9559796624' },
  { id: 'route_govind_nagar', routeName: 'GOVIND NAGAR', routeCode: 'RC00004', color: '#7c9ee0', routeExecutive: 'Ayush Gupta', routeExecutiveContact: '8299485052' },
  { id: 'route_kidwai_nagar', routeName: 'KIDWAI NAGAR', routeCode: 'RC00005', color: '#d16257', routeExecutive: 'Ayush Gupta', routeExecutiveContact: '8299485052' },
  { id: 'route_barra', routeName: 'Barra', routeCode: 'RC00006', color: '#7fb298', routeExecutive: 'Ayush Gupta', routeExecutiveContact: '8299485052' },
  { id: 'route_bairi', routeName: 'BAIRI', routeCode: 'RC00001', color: '#e8a33d', routeExecutive: 'Ayush Gupta', routeExecutiveContact: '8299485052' },
  { id: 'route_shastri_nagar', routeName: 'Shastri Nagar', routeCode: 'RC00003', color: '#c99be0', routeExecutive: 'Ayush Gupta', routeExecutiveContact: '7052120237' },
];

// Runtime registry of custom route colors so all components resolve route colors synchronously
const customRouteColorMap: Record<string, string> = { ...ROUTE_COLORS };

export function syncRouteColors(routes: RouteConfig[]): void {
  routes.forEach((r) => {
    if (r.routeName && r.color) {
      customRouteColorMap[r.routeName] = r.color;
    }
  });
}

export function getRouteColor(routeName: string): string {
  if (!routeName) return DEFAULT_ROUTE_COLOR;
  if (customRouteColorMap[routeName]) return customRouteColorMap[routeName];
  const found = Object.keys(customRouteColorMap).find(
    (k) => k.toLowerCase() === routeName.toLowerCase()
  );
  if (found) return customRouteColorMap[found];
  return DEFAULT_ROUTE_COLOR;
}
