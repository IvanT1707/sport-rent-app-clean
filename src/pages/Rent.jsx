// Замініть useEffect для завантаження обладнання в rent.jsx на цей:

useEffect(() => {
  const fetchEquipment = async () => {
    console.log('Starting to fetch equipment...');
    try {
      console.log('Calling getEquipment()...');
      const response = await getEquipment();
      console.log('Response from getEquipment():', response);
      
      // Handle different response formats
      let data = [];
      
      if (response && response.data && Array.isArray(response.data)) {
        data = response.data;
      } else if (response && Array.isArray(response)) {
        data = response;
      } else {
        console.warn('Unexpected response format:', response);
        data = [];
      }
      
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
      
      // Show user-friendly error message
      const errorMessage = err.message || 'Не вдалося завантажити обладнання';
      
      // Try to use cached data if available
      try {
        console.log('Trying to load from localStorage...');
        const cached = localStorage.getItem('equipmentList');
        if (cached) {
          console.log('Found cached equipment data');
          const data = JSON.parse(cached);
          if (Array.isArray(data) && data.length > 0) {
            console.log('Setting equipment list from cache');
            setEquipmentList(data);
            // Show warning about using cached data
            alert(`Використовуються збережені дані. ${errorMessage}`);
            return;
          }
        } else {
          console.log('No cached equipment data found');
        }
      } catch (e) {
        console.error('Error reading cached equipment:', e);
      }
      
      setEquipmentList([]);
      alert(`Помилка завантаження обладнання: ${errorMessage}`);
    }
  };

  if (checkedAuth) {
    fetchEquipment();
  } else {
    // If not authenticated, clear the list
    setEquipmentList([]);
  }
}, [checkedAuth]);