# Modern Sidebar Design System

## Overview
This document outlines the modern sidebar design system implemented for The Bed Shop Stock Addon application.

## Design Principles

### 1. Visual Hierarchy
- **Shadow Effects**: `shadow-lg` on desktop, `shadow-xl` on mobile for depth and separation
- **Clear Boundaries**: Border-right with appropriate colors for light/dark themes
- **Proper Spacing**: Consistent padding and margins throughout

### 2. Interactive States

#### Active State
- **Background**: `bg-blue-50 dark:bg-blue-900/50` - Subtle blue background
- **Border**: `border-r-4 border-blue-600` - Thick blue left border (4px)
- **Text Color**: `text-blue-700 dark:text-blue-300` - Blue text for emphasis
- **Shadow**: `shadow-sm` - Subtle elevation
- **Icon Color**: `text-blue-600 dark:text-blue-400` - Matching blue icons

#### Hover State
- **Background**: `hover:bg-blue-50/50 dark:hover:bg-gray-800` - Light background change
- **Text Color**: `hover:text-blue-700 dark:hover:text-blue-300` - Blue text on hover
- **Transform**: `hover:translate-x-1` - Subtle rightward movement
- **Shadow**: `hover:shadow-sm` - Slight elevation
- **Icon Effects**: `group-hover:text-blue-500 group-hover:scale-110` - Color change and scaling

#### Default State
- **Text Color**: `text-gray-600 dark:text-gray-300` - Neutral gray
- **Icon Color**: `text-gray-400` - Muted gray for icons

### 3. Animation & Transitions
- **Duration**: `transition-all duration-200` - Smooth 200ms transitions
- **Transform Effects**: Subtle translate and scale animations
- **Color Transitions**: Smooth color changes for text and icons

## Color Palette

### Primary Blue (Brand Color)
- Main: `#2563EB` (blue-600)
- Light: `#3B82F6` (blue-500) - hover states
- Dark: `#1D4ED8` (blue-700) - active text
- Background: `#EFF6FF` (blue-50) - active backgrounds

### Neutral Grays
- Text: `#4B5563` (gray-600) - primary text
- Muted: `#9CA3AF` (gray-400) - icons and secondary text
- Background: `#FFFFFF` (white) / `#111827` (gray-900) for dark mode
- Borders: `#E5E7EB` (gray-200) / `#374151` (gray-700) for dark mode

## Layout Structure

### Desktop Sidebar
- **Width**: `w-64` (256px)
- **Position**: Fixed left sidebar
- **Background**: White with shadow for depth
- **Logo Area**: Top section with brand icon and name

### Mobile Sidebar
- **Type**: Overlay sidebar with backdrop
- **Animation**: Slide in/out from left
- **Background**: White/dark with shadow
- **Close**: Backdrop click or close button

### Header
- **Height**: `h-16` (64px)
- **Background**: `bg-white/95` with backdrop blur
- **Shadow**: `shadow-md` for depth
- **Content**: Menu toggle, notifications, theme toggle, user menu

## Navigation Items

### Structure
Each navigation item includes:
- **Icon**: 20x20px icons from Lucide React
- **Label**: Clear, descriptive text
- **State Management**: Active, hover, and default states

### Icons Used
- Dashboard: `HomeIcon`
- Mattresses: `Bed`
- Furniture: `Sofa`
- Accessories: `Package`
- Foam: `Box`
- Export Orders: `Download`

## Implementation Benefits

### User Experience
1. **Clear Navigation**: Users always know where they are
2. **Smooth Interactions**: All transitions are fluid and responsive
3. **Professional Appearance**: Modern design builds trust and confidence
4. **Accessibility**: High contrast and clear visual states

### Development
1. **Consistent Patterns**: Reusable design tokens and components
2. **Responsive Design**: Works across all device sizes
3. **Theme Support**: Light and dark mode compatibility
4. **Maintainable**: Clean component structure

## Next Steps

This design system should be extended to:
1. **Admin Dashboard**: Apply same principles with admin-specific styling
2. **Forms and Inputs**: Consistent styling for form elements
3. **Cards and Content**: Apply shadow and spacing principles
4. **Buttons and Actions**: Consistent interaction patterns
5. **Modals and Overlays**: Shadow and backdrop effects

## Technical Implementation

### Key Components
- `CustomerLayout` - Main layout wrapper
- `CustomerSidebar` - Navigation sidebar
- `CustomerHeader` - Top header bar

### CSS Classes Pattern
```css
/* Active State */
.nav-item-active {
  @apply bg-blue-50 dark:bg-blue-900/50 border-r-4 border-blue-600 
         text-blue-700 dark:text-blue-300 shadow-sm;
}

/* Hover State */
.nav-item-hover {
  @apply hover:bg-blue-50/50 dark:hover:bg-gray-800 
         hover:text-blue-700 dark:hover:text-blue-300 
         hover:translate-x-1 hover:shadow-sm;
}

/* Icon Effects */
.nav-icon {
  @apply mr-3 flex-shrink-0 h-5 w-5 transition-all duration-200
         group-hover:text-blue-500 group-hover:scale-110;
}
```

This design system provides a solid foundation for creating a modern, professional user interface throughout the application.