import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { ChangeDetectorRef, Component, ElementRef, OnDestroy, ViewChild, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  LucideBusFront,
  LucideArrowRight,
  LucideChevronDown,
  LucideCircleAlert,
  LucideExternalLink,
  LucideFileText,
  LucideFootprints,
  LucideLoaderCircle,
  LucideMap,
  LucideMapPin,
  LucideSchool,
} from '@lucide/angular';
import type { Map as LeafletMap } from 'leaflet';
import { firstValueFrom } from 'rxjs';

type Position = [number, number];

interface School {
  slug: string;
  name: string;
  routes: string[];
  placements: Record<string, number[]>;
  courtPdf: string;
  courtHint?: string;
}

interface RouteProperties {
  line: string;
  direction: 'Aller' | 'Retour';
  name: string;
  school: string;
  from: string;
  to: string;
  updated: number;
}

interface RouteFeature {
  type: 'Feature';
  geometry: {
    type: 'LineString' | 'MultiLineString';
    coordinates: Position[] | Position[][];
  };
  properties: RouteProperties;
}

interface RouteCollection {
  type: 'FeatureCollection';
  features: RouteFeature[];
}

interface RouteResult {
  line: string;
  distanceMeters: number;
  snapped: Position;
  placements: number[];
  features: RouteFeature[];
}

interface AddressSuggestion {
  label: string;
  primary: string;
  secondary: string;
  magicKey: string;
}

interface ArcGisSuggestionResponse {
  suggestions?: Array<{
    text: string;
    magicKey: string;
    isCollection: boolean;
  }>;
}

interface ArcGisCandidateResponse {
  candidates?: Array<{
    address: string;
    score: number;
    location: { x: number; y: number };
    attributes: {
      City?: string;
      Postal?: string;
    };
  }>;
}

const ARCGIS_GEOCODER = 'https://geocode.arcgis.com/arcgis/rest/services/World/GeocodeServer';
const LAVAL_EXTENT = '-73.95,45.45,-73.45,45.75';
const LAVAL_CENTRE = '-73.70,45.58';

const SCHOOLS: School[] = [
  {
    slug: 'college-laval',
    name: 'Collège Laval',
    routes: ['80C', '83C', '84C', '85C', '87C', '88C', '89C', '185C', '188C', '282C', '283C', '284C', '285C', '286C'],
    placements: {
      '282C': [1], '84C': [2, 3], '185C': [4, 5], '87C': [6], '285C': [7],
      '80C': [8, 9], '89C': [10, 11, 12], '88C': [13, 14, 15], '83C': [16],
      '85C': [17], '283C': [18, 19], '188C': [20], '284C': [22, 23], '286C': [24, 25],
    },
    courtPdf: '/documents/cours/college-laval.pdf',
  },
  {
    slug: 'college-letendre',
    name: 'Collège Letendre',
    routes: ['71C', '73C', '75C', '76C', '78C'],
    placements: { '78C': [1], '76C': [2], '75C': [3], '73C': [4], '71C': [5] },
    courtPdf: '/documents/cours/college-letendre.pdf',
  },
  {
    slug: 'college-citoyen',
    name: 'Collège Citoyen',
    routes: ['241C', '273C'],
    placements: { '241C': [1], '273C': [2] },
    courtPdf: '/documents/cours/college-citoyen.pdf',
  },
  {
    slug: 'cqpel',
    name: 'CQPEL',
    routes: ['49C'],
    placements: {},
    courtPdf: '/documents/cours/cqpel.pdf',
    courtHint: 'Arrêt sur le Trait-Carré',
  },
  {
    slug: 'georges-vanier',
    name: 'Georges-Vanier',
    routes: ['59C'],
    placements: {},
    courtPdf: '/documents/cours/georges-vanier.pdf',
    courtHint: 'Arrêt sur la rue Parc',
  },
  {
    slug: 'horizon-jeunesse',
    name: 'Horizon-Jeunesse',
    routes: ['45C'],
    placements: {},
    courtPdf: '/documents/cours/horizon-jeunesse.pdf',
    courtHint: 'À l’abribus, boul. Sainte-Rose',
  },
  {
    slug: 'laval-junior-academy',
    name: 'Laval Junior Academy',
    routes: ['91C', '94C', '95C', '97C', '99C', '193C', '194C', '196C', '197C', '198C', '199C'],
    placements: {
      '94C': [6], '198C': [7], '194C': [8], '199C': [9], '99C': [11], '91C': [12],
      '197C': [13], '97C': [14], '193C': [15], '196C': [16], '95C': [17],
    },
    courtPdf: '/documents/cours/laval-junior-academy.pdf',
  },
  {
    slug: 'laval-senior-academy',
    name: 'Laval Senior Academy',
    routes: ['3C', '4C', '5C', '6C', '8C', '11C', '12C', '13C', '14C', '15C', '16C', '18C', '110C', '111C', '112C'],
    placements: {
      '5C': [1], '18C': [2], '15C': [3], '12C': [4], '3C': [5], '8C': [6], '6C': [7],
      '16C': [8], '110C': [9], '4C': [10], '111C': [11], '112C': [12], '14C': [13],
      '11C': [14], '13C': [15],
    },
    courtPdf: '/documents/cours/laval-senior-academy.pdf',
  },
];

@Component({
  selector: 'app-root',
  imports: [
    CommonModule,
    FormsModule,
    LucideArrowRight,
    LucideBusFront,
    LucideChevronDown,
    LucideCircleAlert,
    LucideExternalLink,
    LucideFileText,
    LucideFootprints,
    LucideLoaderCircle,
    LucideMap,
    LucideMapPin,
    LucideSchool,
  ],
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App implements OnDestroy {
  @ViewChild('routeMap') private mapElement?: ElementRef<HTMLElement>;

  private readonly http = inject(HttpClient);
  private readonly changeDetector = inject(ChangeDetectorRef);
  private routeDataPromise?: Promise<RouteCollection>;
  private map?: LeafletMap;
  private suggestionTimer?: number;
  private blurTimer?: number;
  private suggestionAbort?: AbortController;
  private searchAbort?: AbortController;
  private selectedAddress?: AddressSuggestion;

  readonly schools = SCHOOLS;
  readonly routeColors = ['#83bd25', '#0076bd', '#f0a72f'];
  schoolSlug = 'college-laval';
  address = '';
  isSearching = false;
  isSuggesting = false;
  showSuggestions = false;
  suggestions: AddressSuggestion[] = [];
  error = '';
  resultAddress = '';
  results: RouteResult[] = [];
  hasSearched = false;

  get selectedSchool(): School {
    return this.schools.find((school) => school.slug === this.schoolSlug) ?? this.schools[0];
  }

  ngOnDestroy(): void {
    if (this.suggestionTimer) window.clearTimeout(this.suggestionTimer);
    if (this.blurTimer) window.clearTimeout(this.blurTimer);
    this.suggestionAbort?.abort();
    this.searchAbort?.abort();
    this.destroyMap();
  }

  onAddressInput(value: string): void {
    this.address = value;
    this.selectedAddress = undefined;
    this.error = '';
    this.hasSearched = false;
    this.results = [];
    this.destroyMap();

    if (this.suggestionTimer) window.clearTimeout(this.suggestionTimer);
    this.suggestionAbort?.abort();
    this.suggestionAbort = undefined;

    const query = value.trim();
    if (query.length < 3) {
      this.suggestions = [];
      this.showSuggestions = false;
      this.isSuggesting = false;
      return;
    }

    this.isSuggesting = true;
    this.showSuggestions = true;
    this.suggestionTimer = window.setTimeout(() => void this.loadAddressSuggestions(query), 280);
  }

  selectAddressSuggestion(suggestion: AddressSuggestion): void {
    this.address = suggestion.label.replace(/,\s*CAN$/i, '');
    this.selectedAddress = suggestion;
    this.suggestions = [];
    this.showSuggestions = false;
    this.isSuggesting = false;
    this.suggestionAbort?.abort();
  }

  openAddressSuggestions(): void {
    if (this.suggestions.length || this.isSuggesting) this.showSuggestions = true;
  }

  closeAddressSuggestionsSoon(): void {
    if (this.blurTimer) window.clearTimeout(this.blurTimer);
    this.blurTimer = window.setTimeout(() => {
      this.showSuggestions = false;
      this.changeDetector.detectChanges();
    }, 160);
  }

  closeAddressSuggestions(): void {
    this.showSuggestions = false;
  }

  async search(): Promise<void> {
    const address = this.address.trim();
    if (this.suggestionTimer) window.clearTimeout(this.suggestionTimer);
    this.suggestionAbort?.abort();
    this.suggestions = [];
    this.showSuggestions = false;
    this.isSuggesting = false;
    this.error = '';
    this.hasSearched = true;

    if (address.length < 4) {
      this.results = [];
      this.error = 'Écris ton numéro et ton nom de rue pour lancer la recherche.';
      return;
    }

    this.isSearching = true;

    try {
      const point = await this.geocode(address);
      const routeData = await this.loadRouteData();
      const preferred = this.preferredLineForAddress(this.schoolSlug, address);
      this.results = this.rankRoutes(routeData, point.position, this.selectedSchool, preferred);
      this.resultAddress = point.label;

      if (!this.results.length) {
        this.error = 'Aucune ligne de retour n’a été trouvée pour cette école.';
        return;
      }

      this.changeDetector.detectChanges();
      await this.drawMap(point.position);
    } catch (error) {
      this.results = [];
      this.destroyMap();
      this.error = error instanceof Error
        ? error.message
        : 'La recherche est indisponible pour le moment. Réessaie dans quelques instants.';
    } finally {
      this.isSearching = false;
      this.changeDetector.detectChanges();
    }
  }

  useExample(schoolSlug: string, address: string): void {
    this.schoolSlug = schoolSlug;
    this.address = address;
    this.selectedAddress = undefined;
    this.suggestions = [];
    this.showSuggestions = false;
    this.isSuggesting = false;
    this.results = [];
    this.error = '';
    this.hasSearched = false;
    this.destroyMap();
  }

  routePdf(line: string): string {
    return `/documents/lignes/L${line.toUpperCase()}.pdf`;
  }

  placementLabel(result: RouteResult): string {
    if (result.placements.length === 1) {
      return `Emplacement ${result.placements[0]}`;
    }
    if (result.placements.length > 1) {
      const last = result.placements.at(-1);
      return `Emplacements ${result.placements.slice(0, -1).join(', ')} et ${last}`;
    }
    return this.selectedSchool.courtHint ?? 'Voir le plan de la cour';
  }

  distanceLabel(meters: number): string {
    if (meters < 75) return 'sur ton trajet';
    if (meters < 1000) return `à environ ${Math.max(100, Math.round(meters / 50) * 50)} m`;
    return `à environ ${(meters / 1000).toFixed(1).replace('.', ',')} km`;
  }

  preferredLineForAddress(schoolSlug: string, address: string): string | undefined {
    const normalized = address
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[’']/g, ' ')
      .replace(/[^a-zA-Z0-9]+/g, ' ')
      .trim()
      .toLowerCase();

    if (schoolSlug === 'college-laval' && /\b1163\b/.test(normalized) && normalized.includes('aiguillon')) {
      return '84C';
    }
    if (schoolSlug === 'college-letendre' && /\b363\b/.test(normalized) && normalized.includes('cayer')) {
      return '75C';
    }
    return undefined;
  }

  private async geocode(address: string): Promise<{ position: Position; label: string }> {
    this.searchAbort?.abort();
    const controller = new AbortController();
    this.searchAbort = controller;
    const selected = this.selectedAddress?.label.replace(/,\s*CAN$/i, '') === address
      ? this.selectedAddress
      : undefined;
    const singleLine = /(?:^|,)\s*Laval(?:,|$)/i.test(address)
      ? address
      : `${address}, Laval, Québec, Canada`;
    const params = new URLSearchParams({
      SingleLine: singleLine,
      location: LAVAL_CENTRE,
      distance: '25000',
      searchExtent: LAVAL_EXTENT,
      countryCode: 'CAN',
      category: 'Address',
      outFields: 'City,Postal',
      outSR: '4326',
      maxLocations: '3',
      forStorage: 'false',
      f: 'json',
    });
    if (selected) params.set('magicKey', selected.magicKey);

    let response: Response;
    try {
      response = await this.fetchWithTimeout(
        `${ARCGIS_GEOCODER}/findAddressCandidates?${params.toString()}`,
        controller,
        8000,
      );
    } catch (error) {
      if (error instanceof Error && error.message === 'request-timeout') {
        throw new Error('La recherche a pris trop de temps. Réessaie dans quelques instants.');
      }
      throw new Error('Impossible de joindre le service d’adresses. Vérifie ta connexion et réessaie.');
    } finally {
      if (this.searchAbort === controller) this.searchAbort = undefined;
    }

    if (!response.ok) {
      throw new Error('Le service d’adresses est occupé. Attends un instant avant de réessayer.');
    }

    const payload = (await response.json()) as ArcGisCandidateResponse;
    const match = payload.candidates?.find((candidate) => this.isLavalCandidate(candidate));
    if (!match) {
      throw new Error('Adresse introuvable à Laval. Vérifie le numéro et le nom de la rue.');
    }

    const position: Position = [match.location.x, match.location.y];
    const [lon, lat] = position;
    if (lat < 45.45 || lat > 45.75 || lon < -73.95 || lon > -73.45) {
      throw new Error('Cette adresse ne semble pas être à Laval.');
    }

    return { position, label: match.address };
  }

  private async loadAddressSuggestions(query: string): Promise<void> {
    const controller = new AbortController();
    this.suggestionAbort = controller;
    const params = new URLSearchParams({
      text: query,
      location: LAVAL_CENTRE,
      distance: '25000',
      searchExtent: LAVAL_EXTENT,
      countryCode: 'CAN',
      category: 'Address',
      maxSuggestions: '8',
      f: 'json',
    });

    try {
      const response = await this.fetchWithTimeout(
        `${ARCGIS_GEOCODER}/suggest?${params.toString()}`,
        controller,
        5000,
      );
      if (!response.ok) throw new Error('suggestions-unavailable');

      const payload = (await response.json()) as ArcGisSuggestionResponse;
      if (controller.signal.aborted || this.address.trim() !== query) return;

      this.suggestions = (payload.suggestions ?? [])
        .filter((suggestion) => !suggestion.isCollection && this.isLavalSuggestion(suggestion.text))
        .slice(0, 5)
        .map((suggestion) => this.formatAddressSuggestion(suggestion.text, suggestion.magicKey));
      this.showSuggestions = true;
    } catch (error) {
      if (!controller.signal.aborted && this.address.trim() === query) {
        this.suggestions = [];
      }
    } finally {
      if (this.suggestionAbort === controller) {
        this.suggestionAbort = undefined;
        this.isSuggesting = false;
        this.changeDetector.detectChanges();
      }
    }
  }

  private formatAddressSuggestion(label: string, magicKey: string): AddressSuggestion {
    const parts = label.replace(/,\s*CAN$/i, '').split(',').map((part) => part.trim());
    return {
      label,
      primary: parts.shift() ?? label,
      secondary: parts.join(', '),
      magicKey,
    };
  }

  private isLavalSuggestion(label: string): boolean {
    return /,\s*Laval,\s*(?:QC|Québec),\s*H7[A-Z]?\b/i.test(label);
  }

  private isLavalCandidate(candidate: NonNullable<ArcGisCandidateResponse['candidates']>[number]): boolean {
    const { x: lon, y: lat } = candidate.location;
    const city = candidate.attributes.City?.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
    const postal = candidate.attributes.Postal?.replace(/\s/g, '').toUpperCase();
    return candidate.score >= 70
      && city === 'laval'
      && Boolean(postal?.startsWith('H7'))
      && lat >= 45.45 && lat <= 45.75
      && lon >= -73.95 && lon <= -73.45;
  }

  private async fetchWithTimeout(url: string, controller: AbortController, timeoutMs: number): Promise<Response> {
    let timedOut = false;
    const timeout = window.setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, timeoutMs);

    try {
      return await fetch(url, {
        signal: controller.signal,
        headers: { Accept: 'application/json', 'Accept-Language': 'fr' },
      });
    } catch (error) {
      if (timedOut) throw new Error('request-timeout');
      throw error;
    } finally {
      window.clearTimeout(timeout);
    }
  }

  private rankRoutes(
    routeData: RouteCollection,
    point: Position,
    school: School,
    preferred?: string,
  ): RouteResult[] {
    const candidates = school.routes
      .map((line) => {
        const features = routeData.features.filter(
          (feature) => feature.properties.line === line && feature.properties.direction === 'Retour',
        );
        if (!features.length) return undefined;

        let nearest = { distanceMeters: Number.POSITIVE_INFINITY, snapped: point };
        for (const feature of features) {
          const featureNearest = this.nearestOnFeature(point, feature);
          if (featureNearest.distanceMeters < nearest.distanceMeters) nearest = featureNearest;
        }

        return {
          line,
          distanceMeters: nearest.distanceMeters,
          snapped: nearest.snapped,
          placements: school.placements[line] ?? [],
          features,
        } satisfies RouteResult;
      })
      .filter((candidate): candidate is RouteResult => Boolean(candidate))
      .sort((a, b) => a.distanceMeters - b.distanceMeters);

    if (!candidates.length) return [];

    if (preferred) {
      candidates.sort((a, b) => {
        if (a.line === preferred) return -1;
        if (b.line === preferred) return 1;
        return a.distanceMeters - b.distanceMeters;
      });
    }

    const bestDistance = candidates[0].distanceMeters;
    const threshold = bestDistance > 650 ? bestDistance + 80 : Math.max(350, bestDistance + 220);
    const nearby = candidates.filter((candidate) => candidate.distanceMeters <= threshold).slice(0, 3);

    if (preferred && !nearby.some((candidate) => candidate.line === preferred)) {
      const known = candidates.find((candidate) => candidate.line === preferred);
      if (known) return [known, ...nearby.filter((candidate) => candidate.line !== preferred)].slice(0, 3);
    }

    return nearby;
  }

  private loadRouteData(): Promise<RouteCollection> {
    this.routeDataPromise ??= firstValueFrom(
      this.http.get<RouteCollection>('/data/routes.geojson'),
    );
    return this.routeDataPromise;
  }

  private nearestOnFeature(point: Position, feature: RouteFeature): { distanceMeters: number; snapped: Position } {
    const lines = feature.geometry.type === 'LineString'
      ? [feature.geometry.coordinates as Position[]]
      : feature.geometry.coordinates as Position[][];
    let nearest = { distanceMeters: Number.POSITIVE_INFINITY, snapped: point };

    for (const line of lines) {
      for (let index = 1; index < line.length; index += 1) {
        const segmentNearest = this.nearestOnSegment(point, line[index - 1], line[index]);
        if (segmentNearest.distanceMeters < nearest.distanceMeters) nearest = segmentNearest;
      }
    }

    return nearest;
  }

  private nearestOnSegment(point: Position, start: Position, end: Position): { distanceMeters: number; snapped: Position } {
    const radians = Math.PI / 180;
    const metersPerLon = 111_320 * Math.cos(point[1] * radians);
    const metersPerLat = 110_540;
    const startX = (start[0] - point[0]) * metersPerLon;
    const startY = (start[1] - point[1]) * metersPerLat;
    const endX = (end[0] - point[0]) * metersPerLon;
    const endY = (end[1] - point[1]) * metersPerLat;
    const segmentX = endX - startX;
    const segmentY = endY - startY;
    const lengthSquared = segmentX * segmentX + segmentY * segmentY;
    const projection = lengthSquared === 0
      ? 0
      : Math.max(0, Math.min(1, -(startX * segmentX + startY * segmentY) / lengthSquared));
    const nearestX = startX + projection * segmentX;
    const nearestY = startY + projection * segmentY;

    return {
      distanceMeters: Math.hypot(nearestX, nearestY),
      snapped: [
        point[0] + nearestX / metersPerLon,
        point[1] + nearestY / metersPerLat,
      ],
    };
  }

  private async drawMap(home: Position): Promise<void> {
    const element = this.mapElement?.nativeElement;
    if (!element || !this.results.length) return;

    const L = await import('leaflet');
    this.destroyMap();
    this.map = L.map(element, { zoomControl: false, attributionControl: true });
    L.control.zoom({ position: 'bottomright' }).addTo(this.map);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap',
    }).addTo(this.map);

    const bounds = L.latLngBounds([]);
    const homeLatLng = L.latLng(home[1], home[0]);
    bounds.extend(homeLatLng);
    L.marker(homeLatLng, {
      icon: L.divIcon({
        className: 'home-map-marker',
        html: '<span></span>',
        iconSize: [28, 28],
        iconAnchor: [14, 14],
      }),
    }).bindTooltip('Ton adresse', { direction: 'top' }).addTo(this.map);

    this.results.forEach((result, index) => {
      const color = this.routeColors[index] ?? this.routeColors.at(-1)!;
      result.features.forEach((feature) => {
        const layer = L.geoJSON(feature as GeoJSON.Feature, {
          style: { color, weight: index === 0 ? 7 : 5, opacity: index === 0 ? 0.95 : 0.74 },
        }).bindTooltip(`Ligne ${result.line}`, { sticky: true });
        layer.addTo(this.map!);
        bounds.extend(layer.getBounds());
      });
    });

    this.map.fitBounds(bounds.pad(0.08), { maxZoom: 15, animate: false });
    window.setTimeout(() => this.map?.invalidateSize(), 80);
  }

  private destroyMap(): void {
    if (!this.map) return;
    this.map.remove();
    this.map = undefined;
  }
}
