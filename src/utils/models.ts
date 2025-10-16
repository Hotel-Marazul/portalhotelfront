export interface Reservation {
    id: number;
    guestName: string;
    roomNumber: string;
    roomType: string;
    checkIn: string;
    checkOut: string;
    guests: number;
    status: string;
    payment: string;
    totalAmount: number;
  }
  
export interface Room {
    id: string;
    number: string;
    type: string;
    capacity: number;
    price: number;
    status: string;
    categoryId: string;
  }

export interface Category {
  id: string;
  name: string;
  price: number;
  roomsCount?: number; 
}
