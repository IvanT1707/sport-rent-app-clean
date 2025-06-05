import { useEffect, useState } from 'react';
import EquipmentCard from '../components/EquipmentCard';
import Header from '../components/Header';
import Footer from '../components/Footer';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '../firebase';
import { useNavigate } from 'react-router-dom';
import { createRental, getEquipment } from '../api/index.js'; // Import the specific API functions

const Rent = () => {
  const [checkedAuth, setCheckedAuth] = useState(false);
  const [equipmentList, setEquipmentList] = useState(() => {
    // Initialize with an empty array and ensure it's always an array
    try {
      const stored = localStorage.getItem('equipmentList');
      return stored ? JSON.parse(stored) : [];
    } catch (e) {
      console.error('Error initializing equipment list:', e);
      return [];
    }
  });
  const [selectedCategory, setSelectedCategory] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const navigate = useNavigate();

  const fetchToken = async () => {
    const user = auth.currentUser;
    return user ? await user.getIdToken() : null;
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (!user) {
        if (!checkedAuth) {
          alert('Будь ласка, увійдіть у систему');
          navigate('/login');
        }
      } else {
        setCheckedAuth(true);
      }
    });

    return () => unsubscribe();
  }, [checkedAuth, navigate]);

  useEffect(() => {
    const fetchEquipment = async () => {
      console.log('Starting to fetch equipment...');
      try {
        console.log('Calling getEquipment()...');
        const response = await getEquipment();
        console.log('Response from getEquipment():', response);
        
        // Check if response is undefined or null
        if (!response) {
          console.error('Response is undefined or null');
          throw new Error('No response from server');
        }
        
        // Check if response.data exists and is an array
        const data = Array.isArray(response?.data) ? response.data : [];
        console.log('Processed equipment data:', data);
        
        // Log the first item's structure for debugging
        if (data.length > 0) {
          console.log('First equipment item structure:', {
            id: data[0].id,
            name: data[0].name,
            price: data[0].price,
            stock: data[0].stock,
            category: data[0].category
          });
        } else {
          console.log('No equipment data received');
        }
        
        setEquipmentList(data);
        // Store in localStorage as a fallback
        localStorage.setItem('equipmentList', JSON.stringify(data));
      } catch (err) {
        console.error('Помилка завантаження обладнання:', err);
        // Try to use cached data if available
        try {
          console.log('Trying to load from localStorage...');
          const cached = localStorage.getItem('equipmentList');
          if (cached) {
            console.log('Found cached equipment data');
            const data = JSON.parse(cached);
            if (Array.isArray(data)) {
              console.log('Setting equipment list from cache');
              setEquipmentList(data);
              return;
            }
          } else {
            console.log('No cached equipment data found');
          }
        } catch (e) {
          console.error('Error reading cached equipment:', e);
        }
        setEquipmentList([]);
      }
    };

    if (checkedAuth) {
      fetchEquipment();
    } else {
      // If not authenticated, clear the list
      setEquipmentList([]);
    }
  }, [checkedAuth]);

  const handleRent = async (id, startDate, endDate, quantity, name, price) => {
    try {
      if (typeof price !== 'number' || price <= 0) {
        console.error('Некоректна ціна:', price);
        alert('Помилка: ціна обладнання недійсна');
        return;
      }
      
      await createRental({
        equipmentId: id,
        name,
        price: price,
        startDate,
        endDate,
        quantity
      });
      
      alert('Оренду успішно оформлено!');
    } catch (err) {
      console.error('Помилка оформлення оренди:', err);
      const errorMessage = err.response?.data?.error || 'Помилка при оформленні оренди. Будь ласка, спробуйте ще раз.';
      alert(errorMessage);
    }
  };

  const filteredList = (Array.isArray(equipmentList) ? equipmentList : [])
    .filter(item => {
      if (!item || typeof item !== 'object') return false;
      try {
        const matchCategory = !selectedCategory || item.category === selectedCategory;
        const matchSearch = item.name && item.name.toLowerCase().includes(searchTerm.toLowerCase());
        return matchCategory && matchSearch;
      } catch (e) {
        console.error('Error filtering items:', e, item);
        return false;
      }
    });

  return (
    <>
      <Header />
      <main className="my-rent">
        <section className="filters" style={{ padding: '1rem' }}>
          <input
            type="text"
            className="search-input"
            placeholder="Пошук за назвою"
            onChange={e => setSearchTerm(e.target.value)}
          />
          <select
            className="category-select"
            value={selectedCategory}
            onChange={e => setSelectedCategory(e.target.value)}
          >
            <option value="">Усі категорії</option>
            <option value="bike">Велосипеди</option>
            <option value="skate">Ролики</option>
            <option value="other">Інше</option>
          </select>
        </section>

        <section className="equipment">
          <h1>Доступне обладнання</h1>
          <div className="equipment-grid">
            {!Array.isArray(filteredList) || filteredList.length === 0 ? (
              <p>Немає обладнання за вибраними параметрами.</p>
            ) : (
              filteredList
                .filter(item => item && typeof item === 'object' && item.id)
                .map(item => (
                  <EquipmentCard 
                    key={item.id} 
                    item={item} 
                    onRent={handleRent} 
                  />
                ))
            )}
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
};

export default Rent;