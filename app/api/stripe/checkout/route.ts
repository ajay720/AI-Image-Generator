import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';

const stripe = process.env.STRIPE_SECRET_KEY 
  ? new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: '2022-11-15' })
  : null;

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: NextRequest) {
  // Return error if Stripe not configured
  if (!stripe) {
    return NextResponse.json({ error: 'Stripe not configured' }, { status: 500 });
  }
  
  try {
    const { plan } = await request.json();

    const prices: Record<string, string> = {
      starter: 'price_starter', // Replace with actual Stripe price IDs
      pro: 'price_pro',
      unlimited: 'price_unlimited',
    };

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [{ price: prices[plan as string], quantity: 1 }],
      mode: 'payment',
      success_url: `${request.nextUrl.origin}/gallery?success=true`,
      cancel_url: `${request.nextUrl.origin}/pricing?canceled=true`,
      metadata: { plan },
    });

    return NextResponse.json({ url: session.url });

  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}