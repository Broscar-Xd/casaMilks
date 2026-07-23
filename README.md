# Casa Milks - Sistema POS

Sistema de Pedidos y Facturación para restaurante de comida rápida.
Contribuyente RIMPE Negocio Popular — Latacunga, Ecuador.

## Stack

- **Backend:** Node.js, Express, TypeScript, Prisma, PostgreSQL
- **Frontend:** React 18, TypeScript, Vite, TailwindCSS
- **Auth:** JWT
- **Validación:** Zod (compartido lógica)

## Requisitos

- Node.js 18+
- PostgreSQL 14+

## Configuración Rápida

```bash
# 1. Clonar e instalar backend
cd backend
cp .env.example .env
# Editar .env con tus credenciales de PostgreSQL
npm install
npx prisma generate
npx prisma db push
npx prisma db seed

# 2. Iniciar backend
npm run dev

# 3. En otra terminal, instalar e iniciar frontend
cd frontend
npm install
npm run dev
```

## Credenciales de Prueba

| Rol | Nombre de Usuario | Contraseña |
|-----|------------------|-----------|
| Admin | Administrador | admin123 |
| Staff | Personal | staff123 |

## Estructura del Proyecto

```
backend/
├── src/
│   ├── config/         # Configuración (DB, env)
│   ├── controllers/    # Handlers HTTP (thin)
│   ├── services/       # Lógica de negocio
│   ├── repositories/   # Acceso a datos (Prisma)
│   ├── routes/         # Definición de rutas
│   ├── middlewares/     # Auth, validación, errores
│   ├── validators/     # Schemas Zod
│   ├── enums/          # Constantes del sistema
│   ├── types/          # Interfaces compartidas
│   └── utils/          # Helpers
├── prisma/
│   └── schema.prisma   # Modelo de datos
└── package.json

frontend/
├── src/
│   ├── components/     # UI y layout
│   ├── pages/          # Login, POS, Cocina, Admin
│   ├── contexts/       # Auth, Branch
│   ├── hooks/          # Custom hooks
│   ├── services/       # API client
│   ├── lib/            # Utilidades
│   └── types/          # Interfaces
└── package.json
```

## Funcionalidades

- POS con catálogo de productos y carrito
- Pantalla de cocina (KDS) con polling en tiempo real
- Multi-local con configuración fiscal independiente
- Nota de venta electrónica RIMPE (sin IVA)
- Descuento automático de inventario por receta
- Cierre de caja diario con desglose por forma de pago
- Reportes: ventas por producto, franja horaria, forma de pago
- Exportación a Excel
- Roles: ADMIN (completo) y STAFF (solo pedidos)
- Impresión de comprobante al cerrar venta
