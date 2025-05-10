const Product = require('../../models/productSchema');
const Category = require('../../models/categorySchema');

// Controller for About/Our Story page
const loadAboutPage = async (req, res) => {
  try {
    const featuredProducts = await Product.find({ isFeatured: true })
      .populate('category')
      .populate('brand')
      .limit(4);
    
    res.render('about', {
      title: 'Our Story | REVIVO',
      currentPage: 'about',
      featuredProducts
    });
  } catch (error) {
    console.error('Error loading about page:', error);
    res.redirect('/pageNotFound');
  }
};

// Controller for Sustainability page
const loadSustainabilityPage = async (req, res) => {
  try {
    res.render('sustainability', {
      title: 'Sustainability | REVIVO',
      currentPage: 'sustainability'
    });
  } catch (error) {
    console.error('Error loading sustainability page:', error);
    res.redirect('/pageNotFound');
  }
};

// Controller for Careers page
const loadCareersPage = async (req, res) => {
  try {
    res.render('careers', {
      title: 'Careers | REVIVO',
      currentPage: 'careers'
    });
  } catch (error) {
    console.error('Error loading careers page:', error);
    res.redirect('/pageNotFound');
  }
};

// Controller for Press page
const loadPressPage = async (req, res) => {
  try {
    res.render('press', {
      title: 'Press | REVIVO',
      currentPage: 'press'
    });
  } catch (error) {
    console.error('Error loading press page:', error);
    res.redirect('/pageNotFound');
  }
};

// Controller for Shipping & Returns page
const loadShippingPage = async (req, res) => {
  try {
    res.render('shipping', {
      title: 'Shipping & Returns | REVIVO',
      currentPage: 'shipping'
    });
  } catch (error) {
    console.error('Error loading shipping page:', error);
    res.redirect('/pageNotFound');
  }
};

// Controller for FAQ page
const loadFaqPage = async (req, res) => {
  try {
    res.render('faq', {
      title: 'FAQ | REVIVO',
      currentPage: 'faq'
    });
  } catch (error) {
    console.error('Error loading faq page:', error);
    res.redirect('/pageNotFound');
  }
};

// Controller for Size Guide page
const loadSizeGuidePage = async (req, res) => {
  try {
    const categories = await Category.find({ isListed: true });
    
    res.render('size-guide', {
      title: 'Size Guide | REVIVO',
      currentPage: 'size-guide',
      categories
    });
  } catch (error) {
    console.error('Error loading size guide page:', error);
    res.redirect('/pageNotFound');
  }
};

// Controller for Contact Us page
const loadContactPage = async (req, res) => {
  try {
    res.render('contact', {
      title: 'Contact Us | REVIVO',
      currentPage: 'contact'
    });
  } catch (error) {
    console.error('Error loading contact page:', error);
    res.redirect('/pageNotFound');
  }
};

module.exports = {
  loadAboutPage,
  loadSustainabilityPage,
  loadCareersPage,
  loadPressPage,
  loadShippingPage,
  loadFaqPage,
  loadSizeGuidePage,
  loadContactPage
};
