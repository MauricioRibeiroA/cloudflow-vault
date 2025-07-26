import { z } from "zod";

// Password validation schema with security requirements
export const passwordSchema = z
  .string()
  .min(8, "Password must be at least 8 characters long")
  .regex(/[A-Z]/, "Password must contain at least one uppercase letter")
  .regex(/[a-z]/, "Password must contain at least one lowercase letter")
  .regex(/\d/, "Password must contain at least one number")
  .regex(/[^A-Za-z0-9]/, "Password must contain at least one special character");

// Email validation schema
export const emailSchema = z
  .string()
  .email("Please enter a valid email address")
  .min(1, "Email is required");

// Full name validation schema
export const fullNameSchema = z
  .string()
  .min(2, "Full name must be at least 2 characters")
  .max(100, "Full name cannot exceed 100 characters")
  .regex(/^[a-zA-ZÀ-ÿ\s'-]+$/, "Full name can only contain letters, spaces, hyphens, and apostrophes");

// Group name validation schema
export const groupNameSchema = z
  .enum(["super_admin", "company_admin", "user"])
  .refine((val) => ["super_admin", "company_admin", "user"].includes(val), {
    message: "Please select a valid group"
  });

// Login form validation schema
export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, "Password is required")
});

// Sign up form validation schema
export const signUpSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
  fullName: fullNameSchema
});

// Profile update validation schema
export const profileUpdateSchema = z.object({
  fullName: fullNameSchema.optional(),
  email: emailSchema.optional()
});

export type LoginFormData = z.infer<typeof loginSchema>;
export type SignUpFormData = z.infer<typeof signUpSchema>;
export type ProfileUpdateData = z.infer<typeof profileUpdateSchema>;