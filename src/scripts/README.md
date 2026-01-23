# Scripts de Migración

## Fix Reservation Pricing

Este script corrige el problema de cálculo duplicado de IVA en las reservaciones existentes.

### Problema
Las reservaciones estaban calculando el IVA dos veces:
1. El precio de la habitación ya incluye IVA
2. El sistema estaba agregando 16% adicional sobre el precio

Esto causaba que el saldo pendiente mostrara cantidades incorrectas (ej: $580 en lugar de $160).

### Solución
El script:
- Encuentra todas las reservaciones activas con `taxes > 0`
- Recalcula el `totalPrice` sin agregar impuestos adicionales
- Actualiza el `remainingBalance` correctamente

### Cómo ejecutar

```bash
cd api-mihotel
npm run migrate:fix-pricing
```

### Qué hace el script
1. Conecta a la base de datos
2. Busca reservaciones con `pricing.taxes > 0`
3. Para cada reservación:
   - Establece `pricing.taxes = 0`
   - Recalcula `totalPrice = subtotal + fees`
   - Actualiza `remainingBalance = totalPrice - totalPaid`
4. Muestra un resumen de los cambios

### Importante
- El script solo afecta reservaciones activas (`isActive: true`)
- No modifica pagos existentes
- Los nuevos cálculos son automáticos gracias al cambio en el modelo
