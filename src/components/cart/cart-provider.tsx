import { createContext, useContext, useReducer, ReactNode } from 'react';
import { CartItem } from '@/lib/supabase';

type CartState = {
  items: CartItem[];
  total: number;
  store: string;
};

type CartAction =
  | { type: 'ADD_ITEM'; payload: CartItem }
  | { type: 'REMOVE_ITEM'; payload: string }
  | { type: 'UPDATE_QUANTITY'; payload: { id: string; quantity: number } }
  | { type: 'UPDATE_NOTES'; payload: { id: string; notes: string } }
  | { type: 'SET_STORE'; payload: string }
  | { type: 'CLEAR_CART' };

const CartContext = createContext<{
  state: CartState;
  dispatch: React.Dispatch<CartAction>;
} | null>(null);

const initialState: CartState = {
  items: [],
  total: 0,
  store: '',
};

function cartReducer(state: CartState, action: CartAction): CartState {
  switch (action.type) {
    case 'ADD_ITEM': {
      const existingItem = state.items.find(
        (item) => item.id === action.payload.id
      );

      if (existingItem) {
        return {
          ...state,
          items: state.items.map((item) =>
            item.id === action.payload.id
              ? { ...item, quantity: item.quantity + action.payload.quantity }
              : item
          ),
          total: state.total + action.payload.price * action.payload.quantity,
        };
      }

      return {
        ...state,
        items: [...state.items, action.payload],
        total: state.total + action.payload.price * action.payload.quantity,
      };
    }
    case 'REMOVE_ITEM': {
      const item = state.items.find((i) => i.id === action.payload);
      return {
        ...state,
        items: state.items.filter((i) => i.id !== action.payload),
        total: state.total - (item ? item.price * item.quantity : 0),
      };
    }
    case 'UPDATE_QUANTITY': {
      const itemIndex = state.items.findIndex((i) => i.id === action.payload.id);
      if (itemIndex === -1) return state;

      const updatedItems = [...state.items];
      const itemToUpdate = updatedItems[itemIndex];
      const newQuantity = action.payload.quantity;
      const quantityDiff = newQuantity - itemToUpdate.quantity;
      
      // Update the target item's quantity
      updatedItems[itemIndex] = { ...itemToUpdate, quantity: newQuantity };

      // If the updated item is a mattress and has a base_qty, update the corresponding base item
      if (itemToUpdate.category === 'mattress' && itemToUpdate.base_qty) {
        const baseItemId = `${itemToUpdate.id}_base`;
        const baseItemIndex = updatedItems.findIndex(i => i.id === baseItemId);
        
        if (baseItemIndex !== -1) {
          const baseItemToUpdate = updatedItems[baseItemIndex];
          const newBaseQuantity = newQuantity * itemToUpdate.base_qty;
          updatedItems[baseItemIndex] = { ...baseItemToUpdate, quantity: newBaseQuantity };
        }
      }
      
      // Recalculate total
      const newTotal = updatedItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);
      
      return {
        ...state,
        items: updatedItems,
        total: newTotal,
      };
    }
    case 'UPDATE_NOTES': {
      return {
        ...state,
        items: state.items.map((i) =>
          i.id === action.payload.id
            ? { ...i, notes: action.payload.notes }
            : i
        ),
      };
    }
    case 'SET_STORE': {
      return {
        ...state,
        store: action.payload,
      };
    }
    case 'CLEAR_CART':
      return initialState;
    default:
      return state;
  }
}

export function CartProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(cartReducer, initialState);

  return (
    <CartContext.Provider value={{ state, dispatch }}>
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error('useCart must be used within a CartProvider');
  }
  return context;
}