// lib/data/indian_districts.dart
// Indian States and Districts data for IFSC finder

/// Map of Indian states to their districts
const Map<String, List<String>> indianDistricts = {
  'Tamil Nadu': [
    'Chennai', 'Coimbatore', 'Madurai', 'Tiruchirappalli', 'Salem',
    'Tirunelveli', 'Tirupur', 'Erode', 'Vellore', 'Thoothukudi',
    'Thanjavur', 'Dindigul', 'Kanchipuram', 'Cuddalore', 'Villupuram',
    'Nagapattinam', 'Karur', 'Namakkal', 'Krishnagiri', 'Dharmapuri',
    'Sivaganga', 'Virudhunagar', 'Ramanathapuram', 'Theni', 'Pudukkottai',
    'Nilgiris', 'Kanyakumari', 'Perambalur', 'Ariyalur', 'Tiruvarur',
  ],
  'Karnataka': [
    'Bengaluru Urban', 'Bengaluru Rural', 'Mysuru', 'Mangaluru', 'Hubli',
    'Belgaum', 'Gulbarga', 'Davanagere', 'Bellary', 'Shimoga',
    'Tumkur', 'Raichur', 'Bidar', 'Hassan', 'Mandya',
    'Chikmagalur', 'Chitradurga', 'Kodagu', 'Udupi', 'Dharwad',
  ],
  'Kerala': [
    'Thiruvananthapuram', 'Kochi', 'Kozhikode', 'Thrissur', 'Kollam',
    'Kannur', 'Alappuzha', 'Kottayam', 'Palakkad', 'Malappuram',
    'Idukki', 'Pathanamthitta', 'Wayanad', 'Kasaragod',
  ],
  'Andhra Pradesh': [
    'Visakhapatnam', 'Vijayawada', 'Guntur', 'Nellore', 'Kurnool',
    'Tirupati', 'Kakinada', 'Rajahmundry', 'Kadapa', 'Anantapur',
    'Ongole', 'Eluru', 'Chittoor', 'Srikakulam', 'Vizianagaram',
  ],
  'Telangana': [
    'Hyderabad', 'Warangal', 'Nizamabad', 'Karimnagar', 'Khammam',
    'Mahbubnagar', 'Nalgonda', 'Adilabad', 'Medak', 'Rangareddy',
  ],
  'Maharashtra': [
    'Mumbai', 'Pune', 'Nagpur', 'Thane', 'Nashik',
    'Aurangabad', 'Solapur', 'Kolhapur', 'Sangli', 'Satara',
    'Ahmednagar', 'Jalgaon', 'Dhule', 'Nanded', 'Latur',
    'Ratnagiri', 'Sindhudurg', 'Raigad', 'Palghar', 'Bhandara',
  ],
  'Gujarat': [
    'Ahmedabad', 'Surat', 'Vadodara', 'Rajkot', 'Bhavnagar',
    'Jamnagar', 'Junagadh', 'Gandhinagar', 'Anand', 'Mehsana',
    'Bharuch', 'Valsad', 'Navsari', 'Kutch', 'Patan',
  ],
  'Rajasthan': [
    'Jaipur', 'Jodhpur', 'Udaipur', 'Kota', 'Bikaner',
    'Ajmer', 'Alwar', 'Bharatpur', 'Sikar', 'Bhilwara',
    'Pali', 'Nagaur', 'Tonk', 'Chittorgarh', 'Dungarpur',
  ],
  'Uttar Pradesh': [
    'Lucknow', 'Kanpur', 'Agra', 'Varanasi', 'Allahabad',
    'Meerut', 'Ghaziabad', 'Noida', 'Bareilly', 'Aligarh',
    'Moradabad', 'Saharanpur', 'Gorakhpur', 'Faizabad', 'Jhansi',
    'Mathura', 'Firozabad', 'Muzaffarnagar', 'Etawah', 'Rampur',
  ],
  'Madhya Pradesh': [
    'Bhopal', 'Indore', 'Jabalpur', 'Gwalior', 'Ujjain',
    'Sagar', 'Dewas', 'Satna', 'Ratlam', 'Rewa',
    'Murwara', 'Singrauli', 'Burhanpur', 'Khandwa', 'Bhind',
  ],
  'West Bengal': [
    'Kolkata', 'Howrah', 'Durgapur', 'Asansol', 'Siliguri',
    'Bardhaman', 'Malda', 'Baharampur', 'Habra', 'Kharagpur',
    'Darjeeling', 'Jalpaiguri', 'Cooch Behar', 'Purulia', 'Bankura',
  ],
  'Bihar': [
    'Patna', 'Gaya', 'Bhagalpur', 'Muzaffarpur', 'Darbhanga',
    'Purnia', 'Arrah', 'Begusarai', 'Katihar', 'Munger',
    'Chhapra', 'Bettiah', 'Saharsa', 'Sasaram', 'Hajipur',
  ],
  'Odisha': [
    'Bhubaneswar', 'Cuttack', 'Rourkela', 'Berhampur', 'Sambalpur',
    'Puri', 'Balasore', 'Brahmapur', 'Baripada', 'Jharsuguda',
  ],
  'Punjab': [
    'Ludhiana', 'Amritsar', 'Jalandhar', 'Patiala', 'Bathinda',
    'Mohali', 'Pathankot', 'Hoshiarpur', 'Moga', 'Firozpur',
  ],
  'Haryana': [
    'Faridabad', 'Gurgaon', 'Panipat', 'Ambala', 'Yamunanagar',
    'Rohtak', 'Hisar', 'Karnal', 'Sonipat', 'Panchkula',
  ],
  'Delhi': [
    'Central Delhi', 'East Delhi', 'New Delhi', 'North Delhi',
    'North East Delhi', 'North West Delhi', 'South Delhi',
    'South East Delhi', 'South West Delhi', 'West Delhi',
  ],
  'Jharkhand': [
    'Ranchi', 'Jamshedpur', 'Dhanbad', 'Bokaro', 'Hazaribagh',
    'Deoghar', 'Giridih', 'Ramgarh', 'Dumka', 'Chaibasa',
  ],
  'Chhattisgarh': [
    'Raipur', 'Bhilai', 'Bilaspur', 'Korba', 'Durg',
    'Rajnandgaon', 'Raigarh', 'Jagdalpur', 'Ambikapur', 'Dhamtari',
  ],
  'Assam': [
    'Guwahati', 'Silchar', 'Dibrugarh', 'Jorhat', 'Nagaon',
    'Tinsukia', 'Tezpur', 'Bongaigaon', 'Dhubri', 'Diphu',
  ],
  'Uttarakhand': [
    'Dehradun', 'Haridwar', 'Roorkee', 'Haldwani', 'Rudrapur',
    'Kashipur', 'Rishikesh', 'Nainital', 'Almora', 'Pithoragarh',
  ],
  'Himachal Pradesh': [
    'Shimla', 'Mandi', 'Solan', 'Dharamshala', 'Palampur',
    'Baddi', 'Nahan', 'Una', 'Kullu', 'Bilaspur',
  ],
  'Goa': [
    'North Goa', 'South Goa', 'Panaji', 'Margao', 'Vasco',
  ],
  'Chandigarh': [
    'Chandigarh',
  ],
  'Puducherry': [
    'Puducherry', 'Karaikal', 'Mahe', 'Yanam',
  ],
  'Jammu and Kashmir': [
    'Srinagar', 'Jammu', 'Anantnag', 'Baramulla', 'Kupwara',
    'Budgam', 'Pulwama', 'Rajouri', 'Kathua', 'Udhampur',
  ],
  'Arunachal Pradesh': [
    'Itanagar', 'Tawang', 'Ziro', 'Bomdila', 'Pasighat',
  ],
  'Manipur': [
    'Imphal', 'Thoubal', 'Bishnupur', 'Churachandpur', 'Ukhrul',
  ],
  'Meghalaya': [
    'Shillong', 'Tura', 'Jowai', 'Nongstoin', 'Williamnagar',
  ],
  'Mizoram': [
    'Aizawl', 'Lunglei', 'Champhai', 'Serchhip', 'Kolasib',
  ],
  'Nagaland': [
    'Kohima', 'Dimapur', 'Mokokchung', 'Tuensang', 'Wokha',
  ],
  'Sikkim': [
    'Gangtok', 'Namchi', 'Gyalshing', 'Mangan', 'Rangpo',
  ],
  'Tripura': [
    'Agartala', 'Udaipur', 'Dharmanagar', 'Kailasahar', 'Belonia',
  ],
};

/// Get list of all Indian states
List<String> get indianStates => indianDistricts.keys.toList()..sort();

/// Get districts for a given state
List<String> getDistrictsForState(String state) {
  return indianDistricts[state] ?? [];
}
