import { useState } from 'react';
import { auth } from '../firebase';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { Link, useNavigate } from 'react-router-dom';
import Header from '../components/Header';
import Footer from '../components/Footer';

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    try {
      await signInWithEmailAndPassword(auth, email, password);
      alert("Вхід успішний");
      navigate('/');
    } catch (error) {
      alert(error.message);
    }
  };

  return (
    <>
      <Header />
      <main className="payment-form">
        <h2 style={{ textAlign: 'center' }}>Вхід</h2>
        <form onSubmit={handleLogin}>
          <input
            type="email"
            placeholder="Email"
            required
            onChange={e => setEmail(e.target.value)}
          />
          <input
            type="password"
            placeholder="Пароль"
            required
            onChange={e => setPassword(e.target.value)}
          />
          <button type="submit" className="hero-button">Увійти</button>
        </form>
        <p style={{ marginTop: '15px', textAlign: 'center' }}>
          Ще не реєструвався? <Link to="/register">Зареєструйся</Link>
        </p>
      </main>
      <Footer />
    </>
  );
};

export default Login;
