-- La prueba gratis pasa de 14 a 15 días para los negocios que se creen desde ahora.
-- Los negocios que ya existen conservan la fecha que tienen (no se tocan).
-- Durante la prueba el negocio tiene el plan base y todos los complementos (incluido WhatsApp con su propio número).
alter table businesses alter column trial_ends_at set default (now() + interval '15 days');
