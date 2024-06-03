import './App.css';
import About from './components/About';
import Navbar from './components/Navbar';

function App() {
  return (
   <>
   <Navbar/>
   <div className='container-outer'>
      <div className='container'>
        <About/>
      </div>
   </div>
   </>
  );
}

export default App;
