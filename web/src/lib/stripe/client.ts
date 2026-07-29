import 'server-only';
import Stripe from 'stripe';
import { z } from 'zod';

// Wie admin.ts: eager geprueft statt erst beim ersten Aufruf zu scheitern --
// ein fehlender Schluessel soll beim Start auffallen, nicht mitten in einem
// Checkout.
const secretKey = z
  .string()
  .min(1, 'STRIPE_SECRET_KEY fehlt in .env.local')
  .parse(process.env.STRIPE_SECRET_KEY);

export const stripe = new Stripe(secretKey);
