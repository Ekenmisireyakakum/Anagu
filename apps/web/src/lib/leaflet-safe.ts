'use client';

import L from 'leaflet';

type LeafletMapInternal = L.Map & {
  _mapPane?: HTMLElement;
  _loaded?: boolean;
  _container?: HTMLElement;
  _animatingZoom?: boolean;
};

let initialized = false;

export function initSafeLeaflet(): void {
  if (typeof window === 'undefined' || initialized) return;
  initialized = true;

  L.Icon.Default.mergeOptions({
    iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
    iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
    shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  });

  const proto = L.Map.prototype as unknown as {
    _onZoomTransitionEnd?: (this: LeafletMapInternal) => void;
    _move?: (this: LeafletMapInternal, ...args: unknown[]) => unknown;
    remove?: (this: LeafletMapInternal) => L.Map;
    __anaguSafePatched?: boolean;
  };

  if (proto.__anaguSafePatched) return;
  proto.__anaguSafePatched = true;

  const origZoomEnd = proto._onZoomTransitionEnd;
  if (typeof origZoomEnd === 'function') {
    proto._onZoomTransitionEnd = function (this: LeafletMapInternal) {
      if (!this._mapPane || !this._loaded || !this._container || !this._container.isConnected) {
        this._animatingZoom = false;
        return;
      }
      return origZoomEnd.call(this);
    };
  }

  const origMove = proto._move;
  if (typeof origMove === 'function') {
    proto._move = function (this: LeafletMapInternal, ...args: unknown[]) {
      if (!this._mapPane || !this._loaded || !this._container || !this._container.isConnected) {
        this._animatingZoom = false;
        return this;
      }
      return origMove.apply(this, args);
    };
  }

  const origRemove = proto.remove;
  if (typeof origRemove === 'function') {
    proto.remove = function (this: LeafletMapInternal) {
      try {
        this.stop();
      } catch {
        // Ignore animation stop failures during unmount
      }
      this._animatingZoom = false;
      return origRemove.call(this);
    };
  }
}

export function isLeafletMapReady(map: L.Map | null | undefined): boolean {
  if (!map) return false;
  const internal = map as LeafletMapInternal;
  return Boolean(
    internal._mapPane &&
      internal._loaded &&
      internal._container &&
      internal._container.isConnected,
  );
}
