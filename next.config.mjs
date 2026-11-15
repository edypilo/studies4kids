/** @type {import('next').NextConfig} */
const nextConfig = {
  // Módulo nativo (convierte páginas de PDF en imágenes): se carga tal cual, sin empaquetar.
  serverExternalPackages: ['@napi-rs/canvas'],
  experimental: {
    // Las subidas de material (PDF y fotos del móvil) superan el límite de 1 MB por defecto.
    serverActions: { bodySizeLimit: '100mb' },
  },
};

export default nextConfig;
