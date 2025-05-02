import { useState, useEffect } from 'react';
import { 
  Card, 
  CardContent, 
  CardDescription, 
  CardHeader, 
  CardTitle 
} from '@/components/ui/card';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle,
  DialogDescription,
  DialogFooter
} from "@/components/ui/dialog";
import { Loader2, Search, UserPlus, RefreshCw, Eye, Mail } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/hooks/use-toast';

export interface Customer {
  id: string;
  name: string;
  email: string;
  role?: string;
  phone?: string;
  address?: string;
  orders_count?: number;
  total_spent?: number;
  created_at: string;
}

export function CustomerList() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [filteredCustomers, setFilteredCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const { toast } = useToast();

  // Load customers on mount
  useEffect(() => {
    fetchCustomers();
  }, []);

  // Update filtered customers when customers or search query changes
  useEffect(() => {
    filterCustomers();
  }, [customers, searchQuery]);

  // Fetch customers from database
  const fetchCustomers = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.from('users').select('*');
      
      if (error) {
        throw error;
      }
      
      if (data && data.length > 0) {
        setCustomers(data);
      } else {
        // Generate sample data if no customers found
        const sampleCustomers = generateSampleCustomers();
        setCustomers(sampleCustomers);
      }
    } catch (error) {
      console.error('Error fetching customers:', error);
      // Generate sample data on error
      const sampleCustomers = generateSampleCustomers();
      setCustomers(sampleCustomers);
      
      toast({
        title: 'Using Sample Data',
        description: 'Could not load customers from database. Using sample data instead.',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  // Generate sample customer data
  const generateSampleCustomers = (): Customer[] => {
    const sampleCustomers: Customer[] = [];
    
    for (let i = 0; i < 10; i++) {
      const isAdmin = i === 0; // Make the first user an admin
      
      sampleCustomers.push({
        id: `sample-user-${i+1}`,
        name: `Customer ${i+1}`,
        email: `customer${i+1}@example.com`,
        role: isAdmin ? 'admin' : 'customer',
        phone: `555-${100 + i}-${1000 + i}`,
        address: `${123 + i} Sample St, Sample City, SC ${10000 + i}`,
        orders_count: Math.floor(Math.random() * 10),
        total_spent: Math.floor(Math.random() * 5000) + 100,
        created_at: new Date(Date.now() - Math.floor(Math.random() * 90) * 24 * 60 * 60 * 1000).toISOString()
      });
    }
    
    return sampleCustomers;
  };

  // Filter customers based on search query
  const filterCustomers = () => {
    if (!searchQuery) {
      setFilteredCustomers(customers);
      return;
    }
    
    const query = searchQuery.toLowerCase();
    const filtered = customers.filter(
      customer => 
        customer.name.toLowerCase().includes(query) ||
        customer.email.toLowerCase().includes(query) ||
        (customer.phone && customer.phone.includes(query))
    );
    
    setFilteredCustomers(filtered);
  };

  // Format date for display
  const formatDate = (dateString: string) => {
    try {
      const date = new Date(dateString);
      return new Intl.DateTimeFormat('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      }).format(date);
    } catch (error) {
      return 'Invalid date';
    }
  };

  // Format currency
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount);
  };

  // View customer details
  const viewCustomerDetails = (customer: Customer) => {
    setSelectedCustomer(customer);
    setIsDetailOpen(true);
  };

  // Close customer details dialog
  const closeCustomerDetails = () => {
    setIsDetailOpen(false);
  };

  // Send email to customer (placeholder function)
  const emailCustomer = (email: string) => {
    // In a real implementation, this would open an email composition UI
    window.open(`mailto:${email}`);
    
    toast({
      title: 'Email Client Opened',
      description: `Ready to send email to ${email}`,
    });
  };

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-2xl">Customer Management</CardTitle>
            <CardDescription>
              View and manage your customers
            </CardDescription>
          </div>
          <div className="flex space-x-2">
            <Button
              variant="outline"
              onClick={fetchCustomers}
              disabled={loading}
            >
              {loading ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4 mr-2" />
              )}
              Refresh
            </Button>
            <Button>
              <UserPlus className="h-4 w-4 mr-2" />
              Add Customer
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {/* Search Bar */}
          <div className="relative mb-6">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search customers by name, email or phone..."
              className="pl-8"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          
          {loading ? (
            <div className="flex justify-center items-center py-10">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : filteredCustomers.length === 0 ? (
            <div className="text-center py-10 text-muted-foreground">
              No customers found
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Orders</TableHead>
                    <TableHead>Joined</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredCustomers.map((customer) => (
                    <TableRow key={customer.id}>
                      <TableCell className="font-medium">
                        {customer.name}
                      </TableCell>
                      <TableCell>{customer.email}</TableCell>
                      <TableCell>
                        <Badge variant={customer.role === 'admin' ? 'default' : 'outline'}>
                          {customer.role || 'customer'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {customer.orders_count !== undefined ? customer.orders_count : 'N/A'}
                        {customer.total_spent ? ` (${formatCurrency(customer.total_spent)})` : ''}
                      </TableCell>
                      <TableCell>
                        {formatDate(customer.created_at)}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center space-x-2">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => viewCustomerDetails(customer)}
                            title="View Details"
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => emailCustomer(customer.email)}
                            title="Send Email"
                          >
                            <Mail className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
      
      {/* Customer Detail Modal */}
      <Dialog open={isDetailOpen} onOpenChange={closeCustomerDetails}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Customer Details</DialogTitle>
            <DialogDescription>
              Detailed information about the customer
            </DialogDescription>
          </DialogHeader>
          
          {selectedCustomer && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div>
                    <h3 className="text-sm font-medium text-muted-foreground">Name</h3>
                    <p className="text-lg">{selectedCustomer.name}</p>
                  </div>
                  
                  <div>
                    <h3 className="text-sm font-medium text-muted-foreground">Email</h3>
                    <p className="text-lg">{selectedCustomer.email}</p>
                  </div>
                  
                  <div>
                    <h3 className="text-sm font-medium text-muted-foreground">Phone</h3>
                    <p className="text-lg">{selectedCustomer.phone || 'Not provided'}</p>
                  </div>
                  
                  <div>
                    <h3 className="text-sm font-medium text-muted-foreground">Role</h3>
                    <Badge variant={selectedCustomer.role === 'admin' ? 'default' : 'outline'} className="mt-1">
                      {selectedCustomer.role || 'customer'}
                    </Badge>
                  </div>
                </div>
                
                <div className="space-y-4">
                  <div>
                    <h3 className="text-sm font-medium text-muted-foreground">Address</h3>
                    <p className="text-lg">{selectedCustomer.address || 'Not provided'}</p>
                  </div>
                  
                  <div>
                    <h3 className="text-sm font-medium text-muted-foreground">Joined</h3>
                    <p className="text-lg">{formatDate(selectedCustomer.created_at)}</p>
                  </div>
                  
                  <div>
                    <h3 className="text-sm font-medium text-muted-foreground">Total Orders</h3>
                    <p className="text-lg">{selectedCustomer.orders_count !== undefined ? selectedCustomer.orders_count : 'N/A'}</p>
                  </div>
                  
                  <div>
                    <h3 className="text-sm font-medium text-muted-foreground">Total Spent</h3>
                    <p className="text-lg">{selectedCustomer.total_spent ? formatCurrency(selectedCustomer.total_spent) : 'N/A'}</p>
                  </div>
                </div>
              </div>
              
              <DialogFooter>
                <Button 
                  variant="outline" 
                  onClick={() => emailCustomer(selectedCustomer.email)}
                >
                  <Mail className="h-4 w-4 mr-2" />
                  Email Customer
                </Button>
                <Button onClick={closeCustomerDetails}>Close</Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
} 