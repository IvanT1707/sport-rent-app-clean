import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import RentalCard from '../components/RentalCard';
import Header from '../components/Header';
import Footer from '../components/Footer';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '../firebase';

const MyRent = () => {
  const [cart, setCart] = useState([]);
  const [checkedAuth, setCheckedAuth] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [userToken, setUserToken] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        if (!checkedAuth) {
          alert('Будь ласка, увійдіть у систему');
          navigate('/login');
        }
        setUserToken(null);
      } else {
        setCheckedAuth(true);
        try {
          const token = await user.getIdToken();
          setUserToken(token);
        } catch (error) {
          console.error('Помилка отримання токена:', error);
          setError('Помилка авторизації');
        }
      }
    });

    return () => unsubscribe();
  }, [checkedAuth, navigate]);

  useEffect(() => {
    const fetchRentals = async () => {
      if (!userToken) {
        setCart([]);
        setIsLoading(false);
        return;
      }

      try {
        setIsLoading(true);
        setError(null);
        
        console.log('Fetching rentals from API...');
        
        const response = await fetch('/api/rentals', {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${userToken}`,
            'Content-Type': 'application/json'
          }
        });

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const result = await response.json();
        console.log('API response:', result);
        
        const rentals = result.data || [];
        
        // Process the rentals data
        const processedRentals = rentals.map(rental => {
          console.log('Processing rental:', rental);
          
          // Function to safely parse dates from various formats
          const parseDate = (dateValue) => {
            if (!dateValue) return new Date();
            
            try {
              // If it's a Firestore timestamp with toDate method
              if (dateValue.toDate && typeof dateValue.toDate === 'function') {
                return dateValue.toDate();
              }
              
              // If it's a Firestore timestamp object with seconds/nanoseconds
              if (dateValue.seconds !== undefined) {
                return new Date(dateValue.seconds * 1000 + (dateValue.nanoseconds || 0) / 1000000);
              }
              
              // If it's already a Date object
              if (dateValue instanceof Date) {
                return new Date(dateValue);
              }
              
              // If it's an ISO string
              const date = new Date(dateValue);
              return isNaN(date.getTime()) ? new Date() : date;
            } catch (error) {
              console.warn('Error parsing date:', dateValue, error);
              return new Date();
            }
          };
          
          // Parse dates first
          const startDate = parseDate(rental.startDate);
          const endDate = parseDate(rental.endDate);
          
          return {
            id: rental.id,
            name: String(rental.name || 'Без назви'),
            price: Number(rental.price) || 0,
            quantity: Number(rental.quantity) || 1,
            startDate,
            endDate,
            status: rental.status || 'active',
            userId: rental.userId,
            equipmentId: rental.equipmentId
          };
        });

        console.log('Processed rentals:', processedRentals);
        setCart(processedRentals);
        
      } catch (err) {
        console.error('Помилка завантаження оренд:', err);
        setError('Не вдалося завантажити оренди. Спробуйте оновити сторінку.');
        setCart([]);
      } finally {
        setIsLoading(false);
      }
    };

    if (checkedAuth && userToken) {
      fetchRentals();
    } else {
      setCart([]);
      setIsLoading(false);
    }
  }, [checkedAuth, userToken]);

  const cancelRental = async (index) => {
    const rentalToDelete = cart[index];

    if (!rentalToDelete || !rentalToDelete.id) {
      alert('Помилка: не вдалося знайти оренду для скасування');
      return;
    }

    const confirmDelete = window.confirm('Ви впевнені, що хочете скасувати оренду?');
    if (!confirmDelete) return;

    try {
      const response = await fetch(`/api/rentals/${rentalToDelete.id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${userToken}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Помилка видалення');
      }

      // Remove from local state
      const updatedCart = [...cart];
      updatedCart.splice(index, 1);
      setCart(updatedCart);

      alert('Оренду скасовано');
    } catch (error) {
      console.error('Помилка при скасуванні оренди:', error);
      alert(`Не вдалося скасувати оренду: ${error.message}`);
    }
  };

  return (
    <>
      <Header />
      <main className='my-rent'>
        <section style={{ textAlign: 'center' }}>
          <h1 className="hero">Мої оренди</h1>
          <p>Перегляньте список активних та минулих оренд</p>
        </section>
        <div className="rent-list">
          {isLoading ? (
            <p style={{ textAlign: 'center' }}>Завантаження даних...</p>
          ) : error ? (
            <p style={{ textAlign: 'center', color: 'red' }}>{error}</p>
          ) : !Array.isArray(cart) || cart.length === 0 ? (
            <p style={{ textAlign: 'center' }}>Наразі немає активних оренд.</p>
          ) : (
            cart.map((rental, index) => {
              if (!rental || !rental.id) {
                console.warn('Skipping invalid rental at index:', index, rental);
                return null;
              }
              
              console.log('Rendering rental:', rental);
              
              return (
                <RentalCard
                  key={rental.id}
                  rental={rental}
                  onCancel={() => cancelRental(index)}
                />
              );
            })
          )}
        </div>
      </main>
      <Footer />
    </>
  );
};

export default MyRent;