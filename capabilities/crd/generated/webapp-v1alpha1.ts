// This file is auto-generated by kubernetes-fluent-client, do not edit manually

import { a, RegisterKind } from "pepr";

export class WebApp extends a.GenericKind {
  spec?: Spec;
  status?: Status;
}

export interface Spec {
  /**
   * Language defines the language of the web application, either English (en) or Spanish (es).
   */
  language: Language;
  /**
   * Replicas is the number of desired replicas.
   */
  replicas: number;
  /**
   * Theme defines the theme of the web application, either dark or light.
   */
  theme: Theme;
}

/**
 * Language defines the language of the web application, either English (en) or Spanish (es).
 */
export enum Language {
  En = "en",
  Es = "es",
}

/**
 * Theme defines the theme of the web application, either dark or light.
 */
export enum Theme {
  Dark = "dark",
  Light = "light",
}

export interface Status {
  observedGeneration?: number;
  phase?: Phase;
}

export enum Phase {
  Failed = "Failed",
  Pending = "Pending",
  Ready = "Ready",
}

RegisterKind(WebApp, {
  group: "pepr.io",
  version: "v1alpha1",
  kind: "WebApp",
});
