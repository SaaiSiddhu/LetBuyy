import React from "react";

interface BadgeProps {
    children: React.ReactNode;
    variant?: "primary" | "secondary" | "outline" | "sale" | "new";
    className?: string;
}

export const Badge = ({ children, variant = "primary", className = "" }: BadgeProps) => {
    const variants = {
        primary: "bg-primary text-white border-transparent",
        secondary: "bg-secondary text-white border-transparent",
        outline: "bg-transparent border-card text-theme-secondary",
        sale: "bg-red-500 text-white border-transparent shadow-red-200",
        new: "bg-blue-500 text-white border-transparent shadow-blue-200",
    };

    return (
        <span
            className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border shadow-sm ${variants[variant]} ${className}`}
        >
            {children}
        </span>
    );
};
