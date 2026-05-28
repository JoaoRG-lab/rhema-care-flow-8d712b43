-- Extend improvement rotation with external, read-only sources.
ALTER TYPE public.ai_agent ADD VALUE IF NOT EXISTS 'replit';
ALTER TYPE public.ai_agent ADD VALUE IF NOT EXISTS 'huggingface';
